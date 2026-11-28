/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/residual.mjs
 *	@Date: 2026-11-16T16:13:11-08:00 (1794874391)
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
 * @fileoverview The leftover scan: v3 names written somewhere the rewriters could not prove what
 * they are (an options object built in a helper, a destructured method, a node's `__type`, a
 * mocked module path). Each one is reported with its v4 replacement; nothing here edits code.
 * @module @cldmv/slothlet-migrate/lib/residual
 * @internal
 */

import { ENTRIES, EXPORTS, METHODS } from "./data.mjs";
import { flattenChain } from "./chains.mjs";
import { parseOption } from "./options.mjs";
import { escapeRegExp, isStringLiteral, staticName, stringValue } from "./source.mjs";

/** Key and member names too common to report on their own (they need their parent keys to match). */
const GENERIC = new Set([
	"dir",
	"hidden",
	"import",
	"manifest",
	"platform",
	"collision",
	"context",
	"routines",
	"enabled",
	"default",
	"capture",
	"references",
	"attribution",
	"ceiling",
	"provenance",
	"mode",
	"filter",
	"prefix",
	"schema",
	"version",
	"metadata",
	"compilerOptions",
	"setTimeout",
	"clearTimeout",
	"fullName",
	"moduleID",
	"maxAge",
	"rule",
	"remove",
	"get",
	"set",
	"enable",
	"disable",
	"owner",
	"run",
	"scope",
	"inspect",
	"unregister",
	"materialized",
	"add",
	"caller",
	"ownership",
	"SlothletWarning",
	"filePath",
	"sourceFolder",
	"apiPath",
	"taggedAt",
	"baseModuleID",
	"_module"
]);

/** Key-path rows: [segments, entry]. */
const KEY_ROWS = [];
for (const e of ENTRIES) {
	if (!e.old || e.action === "new" || e.action === "behaviour") continue;
	if (e.new && e.new.startsWith(`${e.old}.`)) continue; // the key still exists in v4 (as a group): not a leftover by name
	if (e.kind === "config" && !e.old.includes("[")) KEY_ROWS.push([e.old.split("."), e]);
	else if ((e.kind === "option" || e.kind === "export") && e.old.includes("(")) {
		const o = parseOption(e.old);
		if (o && o.path.length) KEY_ROWS.push([o.path, e]);
	} else if (e.kind === "manifest") KEY_ROWS.push([[e.old.split(":")[1]], e]);
	else if (e.kind === "cli" && e.old.startsWith("package.json:")) KEY_ROWS.push([e.old.slice("package.json:".length).split("."), e]);
}

/**
 * Best key row for a property key with its enclosing key chain.
 * @param {string[]} chain - Keys from the outermost literal down to this key.
 * @returns {object|null} Entry.
 */
export function matchKey(chain) {
	const leaf = chain[chain.length - 1];
	let loose = null;
	for (const [segs, e] of KEY_ROWS) {
		if (segs[segs.length - 1] !== leaf) continue;
		const suffix = segs.length <= chain.length && segs.every((s, i) => chain[chain.length - segs.length + i] === s);
		if (suffix && segs.length > 1) return e;
		if (!GENERIC.has(leaf)) loose ??= e;
	}
	return loose;
}

/** Member names that are v3 method names, with their row. */
const METHOD_NAMES = new Map();
for (const [path, e] of METHODS) {
	if (e.action === "new" || e.action === "behaviour") continue;
	const name = path.split(".").pop();
	if (!GENERIC.has(name) && !METHOD_NAMES.has(name)) METHOD_NAMES.set(name, e);
}
for (const e of ENTRIES) {
	if (e.kind === "method" && e.old && e.old.startsWith("@cldmv/")) METHOD_NAMES.set(e.old.split(".").pop(), e);
}

/** `__x` / `_x` names on nodes and impls. */
const NODE_NAMES = new Map();
for (const e of ENTRIES) {
	if (!e.old) continue;
	if (e.kind !== "node-field" || !e.old.startsWith("<")) continue;
	const name = e.old.split(".").pop();
	if (NODE_NAMES.has(name)) NODE_NAMES.get(name).also.push(e.id);
	else NODE_NAMES.set(name, { id: e.id, also: [] });
}
for (const e of ENTRIES) {
	if (e.kind !== "internal" || !e.old) continue;
	const name = e.old.split(" ")[0];
	if (NODE_NAMES.has(name)) NODE_NAMES.get(name).also.push(e.id);
	else if (name !== "_module") NODE_NAMES.set(name, { id: e.id, also: [] });
}

/** Fields of v3 metadata.get() output that moved to node(). */
const METADATA_FIELDS = new Map();
for (const e of ENTRIES) {
	if (e.kind === "node-field" && e.old && e.old.startsWith("metadata."))
		METADATA_FIELDS.set(e.old.slice("metadata.".length).split(".")[0], e);
}
const INTERNAL_MODULE = ENTRIES.find((e) => e.kind === "internal" && e.old && e.old.startsWith("_module"));

/** CLI flag rows. */
const CLI_FLAGS = ENTRIES.filter((e) => e.kind === "cli" && e.old.startsWith("slothlet typegen ")).map((e) => ({
	flag: e.old.slice("slothlet typegen ".length),
	e
}));

/**
 * Keys of the object literals enclosing a property, outermost first.
 * @param {object[]} ancestors - Ancestors of the Property node.
 * @returns {string[]} Keys.
 */
function keyChain(ancestors) {
	const keys = [];
	for (let i = ancestors.length - 1; i >= 1; i--) {
		const a = ancestors[i];
		if (a.type === "ObjectExpression") continue;
		if (a.type === "Property" && ancestors[i - 1].type === "ObjectExpression" && !a.computed) {
			const k = staticName(a.key, false);
			if (k === null) break;
			keys.unshift(k);
			continue;
		}
		break;
	}
	return keys;
}

/**
 * Whether a node reads like metadata output (`meta.x`, `metadata.x`, `(await …metadata.get…(f)).x`).
 * @param {object} obj - Member object.
 * @returns {boolean} True when plausibly metadata.
 */
function isMetadataLike(obj) {
	let n = obj;
	if (n.type === "AwaitExpression") n = n.argument;
	if (n.type === "Identifier") return /^(meta|metadata|md|metaData)$/i.test(n.name);
	if (n.type === "CallExpression" && n.callee.type === "MemberExpression")
		return flattenChain(n.callee).segments.some((s) => s.name === "metadata");
	return false;
}

/**
 * Visit one node of the original AST for leftovers.
 * @param {object} node - Node.
 * @param {object[]} ancestors - Ancestors.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @param {{ handledLiterals: Set<object> }} state - Literals the rewriters already looked at.
 * @returns {void}
 */
export function visitResidual(node, ancestors, ctx, state) {
	const parent = ancestors[ancestors.length - 1];
	if (
		node.type === "Property" &&
		parent &&
		parent.type === "ObjectExpression" &&
		!ctx.processed.has(parent) &&
		!node.computed &&
		node.kind === "init"
	) {
		const key = staticName(node.key, false);
		if (key === null) return;
		const chain = [...keyChain(ancestors), key];
		const e = matchKey(chain);
		if (e)
			ctx.result.manual(
				e.id,
				node.key.start,
				`${chain.join(".")}: possible v3 ${e.kind} key (${e.old} → ${e.new ?? "removed"}). ${e.note}`.trim()
			);
		return;
	}
	if (node.type === "MemberExpression") {
		const name = staticName(node.property, node.computed);
		if (name === null) return;
		const flat = flattenChain(node);
		const chain = [...(flat.root && flat.root.type === "Identifier" ? [flat.root.name] : []), ...flat.segments.map((s) => s.name)];
		const alias = flat.root && flat.root.type === "Identifier" ? ctx.aliases?.get(flat.root.name) : null;
		const underSlothlet = (chain.indexOf("slothlet") >= 0 && chain.indexOf("slothlet") < chain.length - 1) || !!alias?.proven;
		if (
			!underSlothlet &&
			METHOD_NAMES.has(name) &&
			!(
				parent &&
				parent.type === "MemberExpression" &&
				parent.object === node &&
				METHOD_NAMES.has(staticName(parent.property, parent.computed))
			)
		) {
			const e = METHOD_NAMES.get(name);
			if (!(e.old.startsWith("@cldmv/") && !chain.includes("SlothletWarning"))) {
				ctx.result.manual(e.id, node.property.start, `.${name}: possible v3 method (${e.old} → ${e.new ?? "removed"}). ${e.note}`.trim());
			}
			return;
		}
		if (NODE_NAMES.has(name)) {
			const { id, also } = NODE_NAMES.get(name);
			ctx.result.manual(id, node.property.start, undefined, { also });
			return;
		}
		if (METADATA_FIELDS.has(name) && isMetadataLike(node.object)) {
			ctx.result.manual(METADATA_FIELDS.get(name).id, node.property.start, undefined, {
				also: name === "_module" && INTERNAL_MODULE ? [INTERNAL_MODULE.id] : []
			});
		}
		return;
	}
	if (node.type === "BinaryExpression" && node.operator === "in" && isStringLiteral(node.left) && NODE_NAMES.has(stringValue(node.left))) {
		const { id, also } = NODE_NAMES.get(stringValue(node.left));
		ctx.result.manual(id, node.left.start, undefined, { also });
		return;
	}
	if (isStringLiteral(node) && !state.handledLiterals.has(node)) {
		const value = stringValue(node);
		if (value.startsWith("@cldmv/slothlet/") && !ctx.handledSources.has(node)) {
			const base = value.split("#")[0];
			const whole = EXPORTS.specifiers.get(base);
			if (
				whole &&
				!(
					parent &&
					(parent.type === "ImportDeclaration" ||
						parent.type === "ExportNamedDeclaration" ||
						parent.type === "ExportAllDeclaration" ||
						parent.type === "ImportExpression")
				)
			) {
				ctx.result.manual(whole.id, node.start, `"${value}" names a v3 entry point (→ ${whole.new ?? "removed"}).`);
			}
			return;
		}
		if (/\bslothlet\s+typegen\b/.test(value)) {
			for (const { flag, e } of CLI_FLAGS) {
				if (new RegExp(`(^|\\s)${escapeRegExp(flag)}(?=\\s|=|$)`).test(value))
					ctx.result.manual(e.id, node.start, `CLI flag ${flag} → ${e.new.slice("slothlet typegen ".length)}`);
			}
			return;
		}
		if (value.startsWith("slothlet.") && !(parent && parent.type === "Property" && staticName(parent.key, parent.computed) === "target")) {
			const path = value.slice("slothlet.".length).split(":")[0];
			const e = METHODS.get(path);
			if (e && e.action !== "new" && e.action !== "behaviour")
				ctx.result.manual(e.id, node.start, `"${value}" names v3 slothlet.${path} (→ ${e.new ? e.new.replace(/^api\./, "") : "removed"}).`);
		}
	}
}
