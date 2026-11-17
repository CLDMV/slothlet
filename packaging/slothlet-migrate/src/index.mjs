/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /packaging/slothlet-migrate/src/index.mjs
 *	@Date: 2026-11-16T16:14:43-08:00 (1794874483)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:28:23-08:00 (1794875303)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview @cldmv/slothlet-migrate — rewrites slothlet v3 code, configs and module manifests to
 * v4. Every change it cannot prove is reported (file:line, v3 name → v4 name) instead of guessed.
 * @module @cldmv/slothlet-migrate
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { rewriteConfigNode, markProcessed } from "./lib/config.mjs";
import { CODE_RENAMES, CODE_REMOVED } from "./lib/data.mjs";
import { unifiedDiff } from "./lib/diff.mjs";
import { checkErrorConstructor, rewriteCodeLiteral, rewriteCodeRegex, rewriteErrorContext, rewriteErrorShape } from "./lib/errors.mjs";
import { visitImport } from "./lib/imports.mjs";
import { moveKey, locate } from "./lib/keys.mjs";
import { rewriteChain, rewriteRuleTarget, ruleTargetNode, defer } from "./lib/methods.mjs";
import { ObjModel, detectIndentUnit } from "./lib/object-model.mjs";
import { rewriteOptions } from "./lib/options.mjs";
import { visitResidual } from "./lib/residual.mjs";
import { FileResult } from "./lib/result.mjs";
import { Editor, escapeRegExp, isStringLiteral, parseJson, parseProgram, staticName, stringValue, walk } from "./lib/source.mjs";
import { slothletTail } from "./lib/chains.mjs";

export { unifiedDiff } from "./lib/diff.mjs";
export { ENTRIES, SOURCES } from "./lib/data.mjs";

/** Specifiers whose default (or `slothlet`) export is the slothlet() factory. */
const FACTORY_SPECIFIERS = new Set(["@cldmv/slothlet", "@cldmv/slothlet/slothlet"]);

/**
 * @typedef {object} MigrateOptions
 * @property {string} [filename] - Name used in findings and diffs.
 * @property {string[]} [callees] - Extra function names whose first argument is a slothlet config (e.g. a test helper wrapping slothlet()).
 */

/**
 * @typedef {object} MigrateResult
 * @property {string} file - File name.
 * @property {string} code - Migrated text (the input when nothing changed).
 * @property {boolean} changed - Whether the text changed.
 * @property {import("./lib/result.mjs").Finding[]} findings - Rewrites made, hand edits needed, behaviour notes.
 * @property {string|null} [error] - Parse error, when the file could not be read as JavaScript / JSON.
 */

/**
 * Shared rewrite context for one file.
 * @param {string} code - Text.
 * @param {object[]} comments - Comments.
 * @param {FileResult} result - Findings.
 * @param {boolean} json - JSON document.
 * @returns {import("./lib/config.mjs").RewriteContext} Context.
 */
function createContext(code, comments, result, json) {
	return {
		code,
		comments,
		json,
		result,
		editor: new Editor(code),
		unit: detectIndentUnit(code),
		quote: '"',
		consts: new Map(),
		resolveConst: () => null,
		visited: new Map(),
		processed: new Set(),
		deferred: [],
		exportCalls: new Map(),
		handledSources: new Set(),
		moduleIds: new Set()
	};
}

/**
 * Most common quote character among string literals.
 * @param {object} ast - Program.
 * @param {string} code - Text.
 * @returns {string} `"` or `'`.
 */
function dominantQuote(ast, code) {
	let single = 0;
	let double = 0;
	walk(ast, (n) => {
		if (n.type === "Literal" && typeof n.value === "string") {
			if (code[n.start] === "'") single++;
			else if (code[n.start] === '"') double++;
		}
	});
	return single > double ? "'" : '"';
}

/**
 * Names bound to the slothlet() factory in this file.
 * @param {object} ast - Program.
 * @returns {Set<string>} Local names.
 */
function factoryNames(ast) {
	const names = new Set();
	walk(ast, (n) => {
		if (n.type === "ImportDeclaration" && FACTORY_SPECIFIERS.has(n.source.value)) {
			for (const s of n.specifiers) {
				if (s.type === "ImportDefaultSpecifier") names.add(s.local.name);
				else if (s.type === "ImportSpecifier" && (s.imported.name === "slothlet" || s.imported.name === "default")) names.add(s.local.name);
			}
		}
		if (n.type === "VariableDeclarator" && n.init) {
			let init = n.init;
			if (init.type === "AwaitExpression") init = init.argument;
			if (init.type === "MemberExpression" && !init.computed && init.property.name === "default")
				init = init.object.type === "AwaitExpression" ? init.object.argument : init.object;
			const spec =
				init.type === "CallExpression" && init.callee.type === "Identifier" && init.callee.name === "require"
					? init.arguments[0]
					: init.type === "ImportExpression"
						? init.source
						: null;
			if (!spec || spec.type !== "Literal" || !FACTORY_SPECIFIERS.has(spec.value)) return;
			if (n.id.type === "Identifier") names.add(n.id.name);
			else if (n.id.type === "ObjectPattern") {
				for (const p of n.id.properties) {
					if (p.type === "Property" && !p.computed && ["slothlet", "default"].includes(p.key.name) && p.value.type === "Identifier")
						names.add(p.value.name);
				}
			}
		}
	});
	return names;
}

/**
 * Module ids this file mounts with: `moduleID: "x"` anywhere, and `id: "x"` in an api.add options object.
 * @param {object} ast - Program.
 * @returns {Set<string>} Ids.
 */
function moduleIds(ast) {
	const ids = new Set();
	const take = (obj, keys) => {
		for (const p of obj.properties) {
			if (p.type === "Property" && !p.computed && keys.includes(staticName(p.key, false)) && isStringLiteral(p.value))
				ids.add(stringValue(p.value));
		}
	};
	walk(ast, (n) => {
		if (n.type === "ObjectExpression") take(n, ["moduleID"]);
		if (
			n.type === "CallExpression" &&
			n.callee.type === "MemberExpression" &&
			n.arguments[2] &&
			n.arguments[2].type === "ObjectExpression"
		) {
			const tail = slothletTail(n.callee);
			if (tail && tail.segments.map((t) => t.name).join(".") === "api.add") take(n.arguments[2], ["id"]);
		}
	});
	return ids;
}

/**
 * Index `const name = { … }` declarations whose name is declared exactly once in the file.
 * @param {object} ast - Program.
 * @returns {(name: string) => object|null} Resolver.
 */
function constResolver(ast) {
	const decls = new Map();
	walk(ast, (n) => {
		if (n.type !== "VariableDeclaration") return;
		for (const d of n.declarations) {
			if (d.id.type !== "Identifier") continue;
			const list = decls.get(d.id.name) ?? [];
			list.push(n.kind === "const" && d.init && d.init.type === "ObjectExpression" ? d.init : null);
			decls.set(d.id.name, list);
		}
	});
	walk(ast, (n) => {
		const params = n.params ?? (n.type === "CatchClause" && n.param ? [n.param] : []);
		for (const p of params) if (p.type === "Identifier" && decls.has(p.name)) decls.get(p.name).push(null);
	});
	return (name) => {
		const list = decls.get(name);
		return list && list.length === 1 ? list[0] : null;
	};
}

/**
 * Migrate JavaScript source.
 * @param {string} code - Source text.
 * @param {MigrateOptions} [options] - Options.
 * @returns {MigrateResult} Result.
 */
export function migrateSource(code, options = {}) {
	const file = options.filename ?? "<source>";
	const result = new FileResult(file, code);
	let parsed;
	try {
		parsed = parseProgram(code);
	} catch (error) {
		return { file, code, changed: false, findings: [], error: error.message };
	}
	const { ast, comments } = parsed;
	const ctx = createContext(code, comments, result, false);
	ctx.quote = dominantQuote(ast, code);
	ctx.resolveConst = constResolver(ast);
	const factories = factoryNames(ast);
	for (const name of options.callees ?? []) factories.add(name);
	const handledLiterals = new Set();
	ctx.moduleIds = moduleIds(ast);

	// Pass 1: in-place edits of small, self-contained nodes.
	walk(ast, (node, ancestors) => {
		visitImport(node, ancestors, ctx);
		if (node.type === "Literal" && typeof node.value === "string" && (CODE_RENAMES.has(node.value) || CODE_REMOVED.has(node.value))) {
			rewriteCodeLiteral(node, ancestors, ctx);
			handledLiterals.add(node);
		}
		if (node.type === "Literal" && node.regex && (CODE_RENAMES.has(node.regex.pattern) || CODE_REMOVED.has(node.regex.pattern)))
			rewriteCodeRegex(node, ancestors, ctx);
		if (node.type === "ObjectExpression") {
			const target = ruleTargetNode(node);
			if (target) {
				rewriteRuleTarget(target, ctx);
				handledLiterals.add(target);
			}
			rewriteErrorShape(node, ctx);
		}
		if (node.type === "MemberExpression") {
			rewriteChain(node, ancestors, ctx);
			rewriteErrorContext(node, ancestors, ctx);
		}
		if (node.type === "NewExpression") checkErrorConstructor(node, ctx);
	});

	// Pass 2: whole-literal rewrites (configs, option objects), smallest first.
	walk(ast, (node) => {
		if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return;
		const name = node.callee.name;
		const arg = node.arguments[0];
		if (factories.has(name) && arg) {
			defer(ctx, node, () => {
				if (arg.type === "ObjectExpression") rewriteConfigNode(arg, [], ctx, true);
				else if (arg.type === "Identifier") {
					const target = ctx.resolveConst(arg.name);
					if (target) rewriteConfigNode(target, [], ctx, true);
				}
			});
		}
		const exported = ctx.exportCalls.get(name);
		if (exported && node.arguments[exported.index])
			defer(ctx, node, () => rewriteOptions(node.arguments[exported.index], exported.id, exported.index, ctx));
	});
	ctx.deferred.sort((a, b) => a.size - b.size || a.start - b.start);
	for (const task of ctx.deferred) task.run();

	// Pass 3: report what is left.
	walk(ast, (node, ancestors) => visitResidual(node, ancestors, ctx, { handledLiterals }));

	const out = ctx.editor.result();
	return { file, code: out, changed: out !== code, findings: result.sorted(), error: null };
}

/**
 * Migrate a JSON document: a slothlet config file, a `slothlet.module.json`, or a `package.json`.
 * @param {string} text - JSON text.
 * @param {MigrateOptions & { kind?: "config"|"manifest"|"package" }} [options] - Options (kind defaults from the file name).
 * @returns {MigrateResult} Result.
 */
export function migrateJson(text, options = {}) {
	const file = options.filename ?? "<json>";
	const kind =
		options.kind ?? (basename(file) === "slothlet.module.json" ? "manifest" : basename(file) === "package.json" ? "package" : "config");
	const result = new FileResult(file, text);
	let parsed;
	try {
		parsed = parseJson(text);
	} catch (error) {
		return { file, code: text, changed: false, findings: [], error: error.message };
	}
	const { ast, comments } = parsed;
	if (ast.type !== "ObjectExpression") return { file, code: text, changed: false, findings: [], error: null };
	const ctx = createContext(text, comments, result, true);
	walk(ast, (node) => {
		if (node.type !== "ObjectExpression") return;
		const target = ruleTargetNode(node);
		if (target) rewriteRuleTarget(target, ctx);
	});
	if (kind === "config") rewriteConfigNode(ast, [], ctx, true);
	else if (kind === "manifest") migrateManifest(ast, ctx);
	else if (kind === "package") migratePackageJson(ast, ctx);
	const out = ctx.editor.result();
	return { file, code: out, changed: out !== text, findings: result.sorted(), error: null };
}

/**
 * slothlet.module.json format 1 → 2.
 * @param {object} ast - Root object.
 * @param {import("./lib/config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
function migrateManifest(ast, ctx) {
	markProcessed(ast, ctx.processed);
	const model = new ObjModel(ctx, ast);
	const version = model.get("schemaVersion");
	if (version) {
		const v = version.valueNode;
		if (v && v.type === "Literal" && v.value === 1 && !model.get("schema")) {
			version.key = "schema";
			version.valueText = "2";
			version.dirty = true;
			model.touch();
			ctx.result.rewrite("manifest|slothlet.module.json:schemaVersion", version.node.start, "schemaVersion: 1 → schema: 2");
		} else {
			ctx.result.manual(
				"manifest|slothlet.module.json:schemaVersion",
				version.node.start,
				"schemaVersion → schema (format 2); this file's value is not 1, so it was left alone."
			);
		}
	}
	moveKey(model, [], ["mountPath"], ["mount"], { id: "manifest|slothlet.module.json:mountPath", result: ctx.result });
	moveKey(model, [], ["apiDir"], ["base"], { id: "manifest|slothlet.module.json:apiDir", result: ctx.result });
	if (model.changed) ctx.editor.replace(ast.start, ast.end, model.print());
}

const TYPEGEN_FLAGS = [
	["--dir", "--base", "cli|slothlet typegen --dir"],
	["-d", "-b", "cli|slothlet typegen -d"],
	["--interface-name", "--name", "cli|slothlet typegen --interface-name"],
	["--no-augment-runtime", "--no-augment", "cli|slothlet typegen --no-augment-runtime"]
];

/**
 * Rewrite `slothlet typegen` flags in a shell command string.
 * @param {string} command - Command.
 * @returns {{ text: string, ids: string[] }} New command and the rows applied.
 */
export function rewriteTypegenCommand(command) {
	const ids = [];
	const text = command.replace(/(\bslothlet\s+typegen\b)([^&|;]*)/g, (all, head, args) => {
		let next = args;
		for (const [from, to, id] of TYPEGEN_FLAGS) {
			const re = new RegExp(`(^|\\s)${escapeRegExp(from)}(?=\\s|=|$)`, "g");
			if (re.test(next)) {
				next = next.replace(re, `$1${to}`);
				ids.push(id);
			}
		}
		return head + next;
	});
	return { text, ids };
}

/**
 * package.json: the `slothlet.typegen` CLI fallback keys and `slothlet typegen` flags in scripts.
 * @param {object} ast - Root object.
 * @param {import("./lib/config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
function migratePackageJson(ast, ctx) {
	const model = new ObjModel(ctx, ast);
	moveKey(model, [], ["slothlet", "typegen", "dir"], ["slothlet", "typegen", "base"], {
		id: "cli|package.json:slothlet.typegen.dir",
		result: ctx.result
	});
	moveKey(model, [], ["slothlet", "typegen", "interfaceName"], ["slothlet", "typegen", "name"], {
		id: "cli|package.json:slothlet.typegen.interfaceName",
		result: ctx.result
	});
	const scripts = locate(model, ["scripts"]);
	if (scripts && scripts.prop.value) {
		for (const p of scripts.prop.value.props) {
			if (p.type !== "prop" || !p.valueNode || p.valueNode.type !== "Literal" || typeof p.valueNode.value !== "string") continue;
			const { text, ids } = rewriteTypegenCommand(p.valueNode.value);
			if (!ids.length) continue;
			p.valueText = JSON.stringify(text);
			p.dirty = true;
			scripts.prop.value.touch();
			for (const id of ids)
				ctx.result.rewrite(id, p.valueNode.start, `scripts.${p.key}: ${id.split("|")[1]} → ${TYPEGEN_FLAGS.find((f) => f[2] === id)[1]}`);
		}
	}
	if (model.changed) ctx.editor.replace(ast.start, ast.end, model.print());
}

const JS_EXT = new Set([".js", ".mjs", ".cjs"]);
const TS_EXT = new Set([".ts", ".mts", ".cts", ".tsx", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage"]);

/**
 * How a file is handled.
 * @param {string} path - File path.
 * @param {Set<string>} configs - Paths given as config JSON files.
 * @returns {"js"|"json"|"skip-ts"|null} Handling.
 */
export function classify(path, configs = new Set()) {
	const name = basename(path);
	if (configs.has(path)) return "json";
	if (name === "slothlet.module.json" || name === "package.json") return "json";
	const ext = extname(name);
	if (JS_EXT.has(ext)) return "js";
	if (TS_EXT.has(ext)) return "skip-ts";
	return null;
}

/**
 * Expand files and folders into the files to migrate.
 * @param {string[]} paths - Inputs.
 * @param {Set<string>} [configs] - Config JSON files.
 * @returns {{ files: string[], skipped: string[] }} Files to process and TypeScript files left out.
 */
export function collectFiles(paths, configs = new Set()) {
	const files = [];
	const skipped = [];
	const visit = (p) => {
		const st = statSync(p);
		if (st.isDirectory()) {
			for (const entry of readdirSync(p).sort()) {
				if (entry.startsWith(".") || SKIP_DIRS.has(entry)) continue;
				visit(join(p, entry));
			}
			return;
		}
		const kind = classify(p, configs);
		if (kind === "js" || kind === "json") files.push(p);
		else if (kind === "skip-ts") skipped.push(p);
	};
	for (const p of paths) visit(p);
	for (const c of configs) if (!files.includes(c)) files.push(c);
	return { files, skipped };
}

/**
 * Migrate one file on disk (reads it; writes only when `write` is set).
 * @param {string} path - File path.
 * @param {MigrateOptions & { write?: boolean, cwd?: string, configs?: Set<string> }} [options] - Options.
 * @returns {MigrateResult & { diff: string }} Result with a unified diff.
 */
export function migrateFile(path, options = {}) {
	const text = readFileSync(path, "utf8");
	const filename = relative(options.cwd ?? process.cwd(), path) || path;
	const kind = classify(path, options.configs);
	const res =
		kind === "json"
			? migrateJson(text, { ...options, filename, kind: options.configs?.has(path) ? "config" : undefined })
			: migrateSource(text, { ...options, filename });
	if (res.changed && options.write) writeFileSync(path, res.code);
	return { ...res, diff: res.changed ? unifiedDiff(text, res.code, filename) : "" };
}
