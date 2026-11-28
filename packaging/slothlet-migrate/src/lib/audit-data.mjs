/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/audit-data.mjs
 *	@Date: 2026-11-16T19:01:06-08:00 (1794884466)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:34-08:00 (1795869034)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Audit-only checks for the data a program reads off slothlet objects: event and lifecycle
 * payloads, hook contexts, error details and diagnostics results. Driven by data/audit.json; report-only.
 * @module @cldmv/slothlet-migrate/lib/audit-data
 * @internal
 */

import { AUDIT } from "./data.mjs";
import { flattenChain, isChainTop } from "./chains.mjs";
import { isStringLiteral, staticName, stringValue, walk } from "./source.mjs";

const FUNCTIONS = new Set(["FunctionExpression", "ArrowFunctionExpression", "FunctionDeclaration"]);
const ERROR_NAMES = /^(e|err|error|ex|exc|warning|warn|w)$/;

/** @type {Map<string, Map<string, { to: string|null, note: string }>>} */
const TABLES = new Map();
for (const [scope, def] of Object.entries(AUDIT.scopes)) {
	const keys = new Map();
	for (const [old, value] of Object.entries(def.keys)) keys.set(old, typeof value === "string" ? { to: value, note: "" } : value);
	TABLES.set(scope, keys);
}

/**
 * The scope of each parameter of a handler passed to this call, or null when the call takes no tracked handler.
 * @param {object} call - CallExpression.
 * @returns {(string|null)[]|null} Scope per parameter index.
 */
function handlerScopes(call) {
	if (call.callee.type !== "MemberExpression") return null;
	const names = flattenChain(call.callee).segments.map((s) => s.name);
	const tail = names[names.length - 1];
	if (names.includes("hook") && tail === "on") return ["hook"];
	if (names.includes("lifecycle") && (tail === "on" || tail === "once")) return ["lifecycle"];
	if (names.includes("event") && tail === "strategy") return ["strategy"];
	if (names.includes("event") && (tail === "on" || tail === "once")) return [null, "event-meta"];
	return null;
}

/**
 * The scope of a variable initialised from a diagnostics call, or null.
 * @param {object} init - Initialiser expression.
 * @returns {string|null} Scope.
 */
function diagScope(init) {
	let n = init;
	if (n.type === "AwaitExpression") n = n.argument;
	if (n.type !== "CallExpression" || n.callee.type !== "MemberExpression") return null;
	const names = flattenChain(n.callee).segments.map((s) => s.name);
	const tail = names[names.length - 1];
	if (names.includes("diag") && tail === "inspect") return "diag-inspect";
	if (names.includes("context") && tail === "diagnostics") return "diag-context";
	if (names.includes("caches") && tail === "get") return "diag-caches";
	if (names.includes("diag") && (tail === "getOwnership" || (names.includes("owner") && tail === "list"))) return "diag-owner";
	return null;
}

/**
 * Find the scope a root identifier stands for at this point.
 * @param {string} name - Identifier name.
 * @param {object[]} ancestors - Ancestors of the node.
 * @param {Map<object, Map<string, string>>} params - Handler parameter scopes by function.
 * @param {Map<string, string>} vars - Diagnostics variables by name.
 * @returns {{ scope: string, strip: number }|null} Scope and how many leading keys are the container (`context` / `details`).
 */
function scopeOf(name, ancestors, params, vars) {
	for (let i = ancestors.length - 1; i >= 0; i--) {
		const a = ancestors[i];
		if (FUNCTIONS.has(a.type) && params.get(a)?.has(name)) return { scope: params.get(a).get(name), strip: 0 };
		if (a.type === "CatchClause" && a.param?.type === "Identifier" && a.param.name === name) return { scope: "error", strip: 1 };
	}
	if (vars.has(name)) return { scope: vars.get(name), strip: 0 };
	if (ERROR_NAMES.test(name)) return { scope: "error", strip: 1 };
	return null;
}

/**
 * Report the deepest tracked key at the start of a key path.
 * @param {string} scope - Scope id.
 * @param {string[]} keys - Key path after the container.
 * @returns {{ index: number, row: object, old: string }|null} Match.
 */
function lookup(scope, keys) {
	const table = TABLES.get(scope);
	for (let i = keys.length - 1; i >= 0; i--) {
		const old = keys.slice(0, i + 1).join(".");
		if (table.has(old)) return { index: i, row: table.get(old), old };
	}
	return null;
}

/**
 * Scan a program for reads of renamed data keys.
 * @param {object} ast - Program.
 * @param {(offset: number, scope: string, old: string, row: { to: string|null, note: string }) => void} report - Collector.
 * @returns {void}
 */
export function auditData(ast, report) {
	const params = new Map();
	const vars = new Map();
	const seenPattern = new Set();

	const checkPattern = (pattern, scope, prefix) => {
		if (!pattern || pattern.type !== "ObjectPattern" || seenPattern.has(pattern)) return;
		seenPattern.add(pattern);
		const table = TABLES.get(scope);
		for (const p of pattern.properties) {
			if (p.type !== "Property" || p.computed) continue;
			const key = staticName(p.key, false);
			if (key === null) continue;
			const path = [...prefix, key].join(".");
			if (table.has(path)) report(p.key.start, scope, path, table.get(path));
			else if (p.value.type === "ObjectPattern" && [...table.keys()].some((k) => k.startsWith(`${path}.`)))
				checkPattern(p.value, scope, [...prefix, key]);
		}
	};

	walk(ast, (node, ancestors) => {
		const parent = ancestors[ancestors.length - 1];
		if (node.type === "CallExpression") {
			const scopes = handlerScopes(node);
			if (scopes) {
				for (const arg of node.arguments) {
					if (!FUNCTIONS.has(arg.type)) continue;
					const names = new Map();
					arg.params.forEach((p, i) => {
						if (!scopes[i]) return;
						if (p.type === "Identifier") names.set(p.name, scopes[i]);
						else checkPattern(p, scopes[i], []);
					});
					params.set(arg, names);
				}
			}
			return;
		}
		if (node.type === "VariableDeclarator" && node.init) {
			const scope = diagScope(node.init);
			if (scope && node.id.type === "Identifier") vars.set(node.id.name, scope);
			else if (scope) checkPattern(node.id, scope, []);
			const init = node.init.type === "AwaitExpression" ? node.init.argument : node.init;
			if (node.id.type === "ObjectPattern") {
				const { root, segments } = flattenChain(init);
				if (root?.type === "Identifier") {
					const found = scopeOf(root.name, ancestors, params, vars);
					const names = segments.map((s) => s.name);
					if (found && (found.strip === 0 || ["context", "details"].includes(names[0])))
						checkPattern(node.id, found.scope, names.slice(found.strip));
				}
			}
			return;
		}
		if (node.type === "BinaryExpression" && ["===", "==", "!==", "!="].includes(node.operator)) {
			const [member, literal] = node.left.type === "MemberExpression" ? [node.left, node.right] : [node.right, node.left];
			if (member.type !== "MemberExpression" || !isStringLiteral(literal)) return;
			const prop = staticName(member.property, member.computed);
			const value = stringValue(literal);
			const map = prop === "source" ? AUDIT.sourceValues.values : prop === "via" ? AUDIT.sourceValues.via : null;
			if (map && Object.hasOwn(map, value))
				report(literal.start, "lifecycle", `${prop} === "${value}"`, {
					to: `${prop} === "${map[value]}"`,
					note: "The value is now a single word."
				});
			return;
		}
		if (node.type !== "MemberExpression" || !isChainTop(node, parent)) return;
		const { root, segments } = flattenChain(node);
		const names = segments.map((s) => s.name);
		if (root?.type === "Identifier") {
			const found = scopeOf(root.name, ancestors, params, vars);
			if (found && (found.strip === 0 || ["context", "details"].includes(names[0]))) {
				const hit = lookup(found.scope, names.slice(found.strip));
				if (hit) {
					report(segments[hit.index + found.strip].property.start, found.scope, hit.old, hit.row);
					return;
				}
			}
		}
		const table = TABLES.get("diag-any");
		for (let i = 0; i < names.length; i++) {
			if (names[i] !== null && table.has(names[i])) report(segments[i].property.start, "diag-any", names[i], table.get(names[i]));
		}
	});
}

/**
 * Label of a scope, for messages.
 * @param {string} scope - Scope id.
 * @returns {string} Label.
 */
export function scopeLabel(scope) {
	return AUDIT.scopes[scope].label;
}
