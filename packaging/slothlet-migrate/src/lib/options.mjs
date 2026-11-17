/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /packaging/slothlet-migrate/src/lib/options.mjs
 *	@Date: 2026-11-16T16:25:24-08:00 (1794875124)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:28:24-08:00 (1794875304)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Option-object rewrites for slothlet methods (`api.add`, `modules.*`, `hook.on`,
 * `reload`, `leaves`, `principal.register`) and for `generate()` from `@cldmv/slothlet/typegen`.
 * @module @cldmv/slothlet-migrate/lib/options
 * @internal
 */

import { ENTRIES } from "./data.mjs";
import { followFragments, markProcessed, q, HIDDEN_REINCLUDE, addHiddenPatterns } from "./config.mjs";
import { locate, moveKey } from "./keys.mjs";
import { ObjModel } from "./object-model.mjs";
import { quoteLike } from "./source.mjs";

const OPTION_RE = /^(.+?)\((\w+)\)(?:\.(.+))?$/;

/** Which argument each v3 option object is, per method path (below `api.slothlet.`) or export. */
export const ARG_INDEX = {
	"api.add": { options: 2, versionConfig: 3 },
	"api.remove": { pathOrModuleId: 0, apiPath: 1 },
	"api.leaves": { options: 1 },
	"api.modules.addDiscovered": { options: 0 },
	"api.modules.addModule": { options: 1 },
	"api.modules.addModules": { options: 1 },
	"api.modules.discover": { options: 0 },
	"hook.on": { pattern: 0, options: 2 },
	"permissions.principal.register": { definition: 1 },
	"permissions.addRule": { rule: 0 },
	reload: { options: 0 },
	"@cldmv/slothlet/typegen#generateTypes": { options: 0 },
	"@cldmv/slothlet/helpers/generate-manifest#generateBrowserAssets": { options: 1 }
};

/** Option rows with their own handling. */
const SPECIAL = new Set([
	"option|api.slothlet.api.add(versionConfig)",
	"option|api.slothlet.api.add(versionConfig).version",
	"option|api.slothlet.api.add(versionConfig).default",
	"option|api.slothlet.api.add(versionConfig).metadata",
	"option|api.slothlet.api.remove(pathOrModuleId, apiPath)",
	"option|api.slothlet.hook.on(pattern)",
	"option|api.slothlet.permissions.addRule(rule)",
	"option|api.slothlet.reload(options).keepInstanceID",
	"option|api.slothlet.api.add(options).hidden",
	"option|api.slothlet.api.add(options).scanHiddenFolders"
]);

/**
 * Parse `api.slothlet.api.add(options).collisionMode` into its parts.
 * @param {string} text - Option row name.
 * @returns {{ method: string, arg: string, path: string[] }|null} Parts (method below `api.slothlet.`, or the export id).
 */
export function parseOption(text) {
	const m = OPTION_RE.exec(text);
	if (!m) return null;
	const method = m[1].startsWith("api.slothlet.") ? m[1].slice("api.slothlet.".length) : m[1];
	return { method, arg: m[2], path: m[3] ? m[3].split(".") : [] };
}

/** Plain key moves per method + argument index. @type {Map<string, Array<{ id: string, from: string[], to: string[] }>>} */
export const OPTION_MOVES = new Map();
for (const e of ENTRIES) {
	if ((e.kind !== "option" && e.kind !== "export") || !e.old || !e.old.includes("(") || SPECIAL.has(e.id)) continue;
	const from = parseOption(e.old);
	const to = e.new ? parseOption(e.new) : null;
	if (!from || !from.path.length) continue;
	const index = ARG_INDEX[from.method]?.[from.arg];
	if (index === undefined) throw new Error(`slothlet-migrate: no argument position for ${e.old}`);
	const key = `${from.method}#${index}`;
	if (!OPTION_MOVES.has(key)) OPTION_MOVES.set(key, []);
	OPTION_MOVES.get(key).push({ id: e.id, from: from.path, to: to ? to.path : null });
}

// addModule / addModules options carry the discovery options as a nested `discover` group.
const SCAN_ROOT = "option|api.slothlet.api.modules.discover(options).scanRoot";
for (const key of ["api.modules.addModule#1", "api.modules.addModules#1"]) {
	if (!OPTION_MOVES.has(key)) OPTION_MOVES.set(key, []);
	OPTION_MOVES.get(key).push({ id: SCAN_ROOT, from: ["discover", "scanRoot"], to: ["discover", "root"] });
}

/**
 * Rewrite an options argument (an object literal, or a const object literal it names).
 * @param {object} node - Argument node.
 * @param {string} method - Method key (below `api.slothlet.`, or export id).
 * @param {number} index - Argument index.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @param {object} [hooks] - Extra per-method steps.
 * @param {(model: ObjModel, prefix: string[]) => void} [hooks.extra] - Runs after the plain moves on each literal.
 * @param {boolean} [hooks.defer] - Do not write the edit; return the model instead.
 * @returns {ObjModel|null} The model of a literal argument (when deferred), else null.
 */
export function rewriteOptions(node, method, index, ctx, hooks = {}) {
	const moves = OPTION_MOVES.get(`${method}#${index}`) ?? [];
	const role = `option:${method}#${index}`;
	const run = (lit, prefix, defer) => {
		const seen = ctx.visited.get(lit);
		if (seen) {
			if (seen !== `${role}:${prefix.join(".")}`)
				ctx.result.manual(
					moves[0]?.id ?? "option|api.slothlet.api.add(options).collisionMode",
					lit.start,
					`This object is used as two different things (${seen}, ${role}); migrate it by hand.`
				);
			return null;
		}
		ctx.visited.set(lit, `${role}:${prefix.join(".")}`);
		markProcessed(lit, ctx.processed);
		const model = new ObjModel(ctx, lit);
		followFragments(model, prefix, ctx, (n, p) => run(n, p, false));
		for (const m of moves) {
			if (m.to) moveKey(model, prefix, m.from, m.to, { id: m.id, result: ctx.result });
			else {
				const loc = prefix.length === 0 ? locate(model, m.from) : null;
				if (loc) ctx.result.manual(m.id, loc.prop.node?.start ?? lit.start);
			}
		}
		hooks.extra?.(model, prefix);
		if (defer) return model;
		if (model.changed) ctx.editor.replace(lit.start, lit.end, model.print());
		return null;
	};
	if (node.type === "ObjectExpression") return run(node, [], !!hooks.defer);
	if (node.type === "Identifier") {
		const target = ctx.resolveConst(node.name);
		if (target) run(target, [], false);
	}
	return null;
}

/**
 * api.add options extras: `scanHiddenFolders` → hidden patterns, `hidden` behaviour note.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {(model: ObjModel, prefix: string[]) => void} Hook.
 */
export function addOptionsExtra(ctx) {
	return (model, prefix) => {
		if (prefix.length) return;
		const scan = model.get("scanHiddenFolders");
		if (scan) {
			const v = scan.valueNode;
			const id = "option|api.slothlet.api.add(options).scanHiddenFolders";
			if (v && v.type === "Literal" && v.value === false) {
				model.drop(scan);
				ctx.result.rewrite(id, scan.node.start, "scanHiddenFolders: false removed (the default)");
			} else if (v && v.type === "Literal" && v.value === true && addHiddenPatterns(model, scan, ctx)) {
				ctx.result.rewrite(
					id,
					scan.node.start,
					`scanHiddenFolders: true → hidden: [..., ${HIDDEN_REINCLUDE.map((p) => q(ctx, p)).join(", ")}]`
				);
			} else {
				ctx.result.manual(
					id,
					scan.node.start,
					`scanHiddenFolders is gone: add ${HIDDEN_REINCLUDE.map((p) => JSON.stringify(p)).join(", ")} to options.hidden where it was true.`
				);
			}
		}
		const hidden = model.get("hidden");
		if (hidden && hidden.node) ctx.result.info("option|api.slothlet.api.add(options).hidden", hidden.node.start);
	};
}

/**
 * Fold api.add's fourth argument into options.version (and rewrite the options keys).
 * `add(p, s, opts, { version: "v1", default: true })` → `add(p, s, { ...opts, version: { tag: "v1", default: true } })`.
 * @param {object} call - CallExpression.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteApiAdd(call, ctx) {
	const args = call.arguments;
	const opts = args[2];
	const vc = args[3];
	const extra = addOptionsExtra(ctx);
	// Inline form: api.add(path, { exports, ...options }); the siblings of `exports` are the options.
	const inline = args[1];
	if (
		inline &&
		inline.type === "ObjectExpression" &&
		inline.properties.some((p) => p.type === "Property" && !p.computed && propName(p) === "exports")
	)
		rewriteOptions(inline, "api.add", 2, ctx, { extra });
	if (!vc) {
		if (opts) rewriteOptions(opts, "api.add", 2, ctx, { extra });
		return;
	}
	const foldId = "option|api.slothlet.api.add(versionConfig)";
	if (args.length > 4 || vc.type === "SpreadElement" || (opts && opts.type === "SpreadElement")) {
		ctx.result.manual(foldId, vc.start);
		return;
	}
	const isNullish = (n) => (n.type === "Literal" && n.value === null) || (n.type === "Identifier" && n.name === "undefined");
	let versionText = null;
	if (vc.type === "ObjectExpression") {
		const known = new Set(["version", "default", "metadata"]);
		const plain = vc.properties.every(
			(p) =>
				p.type === "Property" &&
				!p.computed &&
				!p.method &&
				p.kind === "init" &&
				known.has(p.key.type === "Identifier" ? p.key.name : p.key.value)
		);
		if (!plain) {
			ctx.result.manual(
				foldId,
				vc.start,
				"api.add's 4th argument moves into options.version ({ tag, default, metadata }); this one has keys the tool does not know."
			);
			return;
		}
		ctx.visited.set(vc, "option:api.add#3");
		markProcessed(vc, ctx.processed);
		const model = new ObjModel(ctx, vc);
		const tag = model.get("version");
		if (tag) {
			tag.key = "tag";
			tag.dirty = true;
			model.touch();
			ctx.result.rewrite(
				"option|api.slothlet.api.add(versionConfig).version",
				tag.node.start,
				"versionConfig.version → options.version.tag"
			);
		}
		for (const k of ["default", "metadata"]) {
			const p = model.get(k);
			if (p)
				ctx.result.rewrite(`option|api.slothlet.api.add(versionConfig).${k}`, p.node.start, `versionConfig.${k} → options.version.${k}`);
		}
		versionText = model.print();
	} else if (!isNullish(vc)) {
		ctx.result.manual(
			foldId,
			vc.start,
			"api.add's 4th argument moves into options.version, with its `version` key renamed `tag`; it is not an object literal here."
		);
		return;
	}
	let optsText;
	if (isNullish(opts)) {
		optsText = versionText === null ? null : `{ version: ${versionText} }`;
	} else if (opts.type === "ObjectExpression") {
		const model = rewriteOptions(opts, "api.add", 2, ctx, { extra, defer: true });
		if (!model) {
			ctx.result.manual(foldId, vc.start);
			return;
		}
		if (versionText !== null) {
			if (model.get("version")) {
				ctx.result.manual(foldId, vc.start, "options already has a version key; merge api.add's 4th argument into it by hand.");
				return;
			}
			model.addRaw("version", versionText);
		}
		optsText = model.print();
	} else {
		rewriteOptions(opts, "api.add", 2, ctx, { extra });
		const src = ctx.editor.slice(opts.start, opts.end);
		optsText = versionText === null ? src : `{ ...${src}, version: ${versionText} }`;
	}
	const from = optsText === null ? findPrevComma(ctx.code, opts.start) : opts.start;
	if (ctx.editor.replace(from, vc.end, optsText ?? "")) {
		ctx.result.rewrite(foldId, vc.start, "api.add 4th argument → options.version");
	} else {
		ctx.result.manual(foldId, vc.start);
	}
}

/**
 * Static name of a property.
 * @param {object} p - Property node.
 * @returns {string|undefined} Name.
 */
function propName(p) {
	return p.key.type === "Identifier" ? p.key.name : p.key.value;
}

/**
 * Offset of the comma before an argument.
 * @param {string} code - Source.
 * @param {number} at - Argument start.
 * @returns {number} Offset of the comma (or `at` when there is none).
 */
function findPrevComma(code, at) {
	const i = code.lastIndexOf(",", at);
	return i >= 0 ? i : at;
}

/**
 * reload({ keepInstanceID }) → reload({ instance: "keep" | "new" }).
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {(model: ObjModel, prefix: string[]) => void} Hook.
 */
export function reloadExtra(ctx) {
	return (model, prefix) => {
		if (prefix.length) return;
		const id = "option|api.slothlet.reload(options).keepInstanceID";
		const p = model.get("keepInstanceID");
		if (!p) return;
		if (model.get("instance")) {
			ctx.result.manual(id, p.node.start, "keepInstanceID → instance: both are set; keep one.");
			return;
		}
		const v = p.valueNode;
		let text;
		if (v && v.type === "Literal" && typeof v.value === "boolean") text = q(ctx, v.value ? "keep" : "new");
		else if (v) {
			const src = ctx.editor.slice(v.start, v.end);
			const simple = /^[\w$.]+$/.test(src);
			text = `${simple ? src : `(${src})`} ? ${q(ctx, "keep")} : ${q(ctx, "new")}`;
		} else return;
		p.key = "instance";
		p.valueText = text;
		p.dirty = true;
		model.touch();
		ctx.result.rewrite(id, p.node.start, `keepInstanceID → instance: ${text}`);
	};
}

/** Hook types slothlet knows (`pattern:type`). */
const HOOK_TYPES = new Set(["before", "after", "always", "error", "around"]);

/**
 * hook.on("before:math.*", …) → hook.on("math.*:before", …).
 * @param {object} node - First argument.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteHookPattern(node, ctx) {
	const id = "option|api.slothlet.hook.on(pattern)";
	if (node.type === "Literal" && typeof node.value === "string") {
		const value = node.value;
		const first = value.indexOf(":");
		const last = value.lastIndexOf(":");
		if (first < 0) return;
		const leading = value.slice(0, first);
		const trailing = value.slice(last + 1);
		if (HOOK_TYPES.has(trailing) || !HOOK_TYPES.has(leading)) return;
		const next = `${value.slice(first + 1)}:${leading}`;
		const text = quoteLike(ctx.code, node, next);
		if (ctx.editor.replace(node.start, node.end, text)) ctx.result.rewrite(id, node.start, `"${value}" → "${next}"`);
		return;
	}
	if (node.type === "TemplateLiteral") {
		const head = node.quasis[0].value.cooked ?? "";
		const first = head.indexOf(":");
		if (first > 0 && HOOK_TYPES.has(head.slice(0, first)))
			ctx.result.manual(id, node.start, 'The "type:pattern" form is gone: write "pattern:type" (e.g. "math.*:before").');
	}
}
