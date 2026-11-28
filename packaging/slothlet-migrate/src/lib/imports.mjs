/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/imports.mjs
 *	@Date: 2026-11-16T16:12:14-08:00 (1794874334)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:35-08:00 (1795869035)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Import / require specifiers and imported names that moved, were renamed, became
 * package-private, or were removed. Renames keep the local binding (`generate as generateTypes`),
 * so no other line has to change; anything that would need references rewritten is reported.
 * @module @cldmv/slothlet-migrate/lib/imports
 * @internal
 */

import { EXPORTS } from "./data.mjs";
import { isStringLiteral, quoteLike, staticName, stringValue } from "./source.mjs";

/** Specifiers that are the same module as a public one (same exports). */
const SAME_AS = new Map([["@cldmv/slothlet/slothlet", "@cldmv/slothlet"]]);

/** Exports whose option objects have rewrites: local calls are followed. */
const OPTION_EXPORTS = new Map([
	["@cldmv/slothlet/typegen#generateTypes", 0],
	["@cldmv/slothlet/helpers/generate-manifest#generateBrowserAssets", 1]
]);

/**
 * Where an imported name lives in v4.
 * @param {string} spec - v3 specifier.
 * @param {string} name - Imported name ("default" for a default import, "*" for a namespace).
 * @returns {{ status: "same"|"ok"|"private"|"removed"|"namespace"|"unknown", spec: string, name: string, id: string|null }} Resolution.
 */
export function resolveImport(spec, name) {
	const same = SAME_AS.get(spec);
	const whole = EXPORTS.specifiers.get(spec);
	if (same) return { status: "ok", spec: same, name, id: whole ? whole.id : null };
	const named = EXPORTS.names.get(`${spec}#${name}`);
	if (named) {
		if (!named.new) return { status: "removed", spec, name, id: named.id };
		const [nextSpec, nextName] = named.new.split("#");
		if (nextSpec.startsWith("#")) return { status: "private", spec: nextSpec, name: nextName, id: named.id };
		if (nextName.includes(".")) return { status: "namespace", spec: nextSpec, name: nextName, id: named.id };
		return { status: "ok", spec: nextSpec, name: nextName, id: named.id };
	}
	if (!whole) return { status: "same", spec, name, id: null };
	if (!whole.new) return { status: "removed", spec, name, id: whole.id };
	if (whole.new.startsWith("#")) return { status: "private", spec: whole.new, name, id: whole.id };
	return { status: "unknown", spec: whole.new, name, id: whole.id };
}

/**
 * Message for an import that cannot be rewritten.
 * @param {ReturnType<typeof resolveImport>} r - Resolution.
 * @param {string} spec - v3 specifier.
 * @param {string} name - Imported name.
 * @returns {string} Message.
 */
function message(r, spec, name) {
	const what = name === "*" ? `import * from "${spec}"` : name === "default" ? `default import of "${spec}"` : `${name} from "${spec}"`;
	switch (r.status) {
		case "private":
			return `${what}: no longer public in v4 (package-private ${r.spec}).`;
		case "removed":
			return `${what}: removed in v4.`;
		case "namespace":
			return `${what}: in v4 it is ${r.name} on the namespace exported by "${r.spec}" (import { ${r.name.split(".")[0]} } from "${r.spec}"); update the references by hand.`;
		default:
			return `${what}: "${spec}" moved to "${r.spec}"; check what it exports in v4 and update this import by hand.`;
	}
}

/**
 * Rewrite or report one import / require site.
 * @param {object} sourceNode - The specifier string literal.
 * @param {Array<{ imported: string, node: object|null, local: string|null, shorthand?: boolean, keyNode?: object }>} names - Imported names.
 * @param {"import"|"pattern"|"opaque"} form - Static import, destructuring require/import(), or anything else.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteImportSite(sourceNode, names, form, ctx) {
	const spec = stringValue(sourceNode);
	if (!spec.startsWith("@cldmv/slothlet")) return;
	if (!names.length) {
		const r = resolveImport(spec, "*");
		const renamedInside = [...EXPORTS.names.keys()].some((k) => k.startsWith(`${spec}#`));
		if (r.status === "same" && !renamedInside) return;
		if (r.status === "ok" && !renamedInside) {
			if (ctx.editor.replace(sourceNode.start, sourceNode.end, quoteLike(ctx.code, sourceNode, r.spec)))
				ctx.result.rewrite(r.id, sourceNode.start, `"${spec}" → "${r.spec}"`);
			return;
		}
		const id = r.id ?? [...EXPORTS.names.values()].find((e) => e.old.startsWith(`${spec}#`)).id;
		ctx.result.manual(
			id,
			sourceNode.start,
			r.status === "same" ? `"${spec}": some of its exports were renamed or moved in v4; check the names used here.` : message(r, spec, "*")
		);
		return;
	}
	const resolved = names.map((n) => ({ ...n, r: resolveImport(spec, n.imported) }));
	for (const n of resolved) {
		const key = `${spec}#${n.imported}`;
		if (OPTION_EXPORTS.has(key) && n.local) ctx.exportCalls.set(n.local, { id: key, index: OPTION_EXPORTS.get(key) });
	}
	const affected = resolved.filter((n) => n.r.status !== "same");
	if (!affected.length) return;
	const targets = new Set(resolved.map((n) => (n.r.status === "same" ? spec : n.r.spec)));
	const rewritable = form !== "opaque" && resolved.every((n) => n.r.status === "ok" || n.r.status === "same") && targets.size === 1;
	if (!rewritable) {
		for (const n of affected) ctx.result.manual(n.r.id, (n.node ?? sourceNode).start, message(n.r, spec, n.imported));
		return;
	}
	const nextSpec = [...targets][0];
	if (nextSpec !== spec) ctx.editor.replace(sourceNode.start, sourceNode.end, quoteLike(ctx.code, sourceNode, nextSpec));
	for (const n of affected) {
		if (n.r.name !== n.imported && n.node) {
			let text;
			if (form === "import") text = n.r.name === n.local ? n.r.name : `${n.r.name} as ${n.local}`;
			else text = n.r.name === n.local ? n.r.name : `${n.r.name}: ${n.local}`;
			ctx.editor.replace(n.node.start, n.node.end, text);
		}
		ctx.result.rewrite(n.r.id, (n.node ?? sourceNode).start, `${n.imported} from "${spec}" → ${n.r.name} from "${n.r.spec}"`);
	}
}

/**
 * Visit one node for import forms.
 * @param {object} node - Any node.
 * @param {object[]} ancestors - Ancestors.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function visitImport(node, ancestors, ctx) {
	if (node.type === "ImportDeclaration") {
		const names = node.specifiers.map((s) => {
			if (s.type === "ImportDefaultSpecifier") return { imported: "default", node: s, local: s.local.name };
			if (s.type === "ImportNamespaceSpecifier") return { imported: "*", node: s, local: s.local.name };
			return { imported: staticName(s.imported, false), node: s, local: s.local.name };
		});
		rewriteImportSite(node.source, names, "import", ctx);
		return;
	}
	if ((node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source) {
		rewriteImportSite(node.source, [], "opaque", ctx);
		return;
	}
	if (node.type === "VariableDeclarator" && node.init) {
		const source = requireSource(node.init);
		if (!source) return;
		if (
			node.id.type === "ObjectPattern" &&
			node.id.properties.every((p) => p.type === "Property" && !p.computed && p.value.type === "Identifier")
		) {
			const names = node.id.properties.map((p) => ({ imported: staticName(p.key, false), node: p, local: p.value.name }));
			rewriteImportSite(source, names, "pattern", ctx);
		} else rewriteImportSite(source, [], "opaque", ctx);
		ctx.handledSources.add(source);
		return;
	}
	if ((node.type === "ImportExpression" && isStringLiteral(node.source)) || isRequireCall(node)) {
		const source = node.type === "ImportExpression" ? node.source : node.arguments[0];
		if (ctx.handledSources.has(source)) return;
		const parent = ancestors[ancestors.length - 1];
		const grand = ancestors[ancestors.length - 2];
		if (
			(parent && parent.type === "VariableDeclarator") ||
			(parent && parent.type === "AwaitExpression" && grand && grand.type === "VariableDeclarator")
		)
			return;
		rewriteImportSite(source, [], "opaque", ctx);
	}
}

/**
 * Whether a node is `require("…")`.
 * @param {object} node - Any node.
 * @returns {boolean} True for a static require.
 */
function isRequireCall(node) {
	return (
		node.type === "CallExpression" &&
		node.callee.type === "Identifier" &&
		node.callee.name === "require" &&
		node.arguments.length === 1 &&
		isStringLiteral(node.arguments[0])
	);
}

/**
 * The specifier literal of `require("x")`, `await import("x")` or `import("x")`.
 * @param {object} init - Initializer.
 * @returns {object|null} String node.
 */
function requireSource(init) {
	let n = init;
	if (n.type === "AwaitExpression") n = n.argument;
	if (isRequireCall(n)) return n.arguments[0];
	if (n.type === "ImportExpression" && isStringLiteral(n.source)) return n.source;
	return null;
}
