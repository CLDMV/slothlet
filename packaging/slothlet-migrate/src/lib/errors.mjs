/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /packaging/slothlet-migrate/src/lib/errors.mjs
 *	@Date: 2026-11-16T16:11:17-08:00 (1794874277)
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
 * @fileoverview Error and warning surface: code string literals, `.context` → `.details`, and the
 * removed `originalError` / `suppressConsole` / four-argument constructor.
 * @module @cldmv/slothlet-migrate/lib/errors
 * @internal
 */

import { CODE_REMOVED, CODE_RENAMES, KNOWN_CODES } from "./data.mjs";
import { flattenChain } from "./chains.mjs";
import { quoteLike, staticName } from "./source.mjs";

const MATCHERS_VALUE = new Set(["toBe", "toEqual", "toStrictEqual"]);
const MATCHERS_OBJECT = new Set([
	"toMatchObject",
	"objectContaining",
	"toThrow",
	"toThrowError",
	"toEqual",
	"toStrictEqual",
	"rejects",
	"toThrowWithMessage"
]);
const ERROR_NAMES = /^(e|err|error|ex|exc|warning|warn|w)$/;

/**
 * Whether a node reads `.code` (`err.code`, `err?.code`, `err["code"]`).
 * @param {object} node - Any node.
 * @returns {boolean} True for a `.code` read.
 */
function isCodeRead(node) {
	const n = node && node.type === "ChainExpression" ? node.expression : node;
	return !!n && n.type === "MemberExpression" && staticName(n.property, n.computed) === "code";
}

/**
 * Whether a node reads `.message`.
 * @param {object} node - Any node.
 * @returns {boolean} True for a `.message` read.
 */
function isMessageRead(node) {
	const n = node && node.type === "ChainExpression" ? node.expression : node;
	return !!n && n.type === "MemberExpression" && staticName(n.property, n.computed) === "message";
}

/**
 * Name of the property a call's callee ends with (`expect(x).not.toBe` → "toBe").
 * @param {object} call - CallExpression.
 * @returns {string|null} Name.
 */
function calleeName(call) {
	const c = call.callee;
	if (c.type === "Identifier") return c.name;
	if (c.type === "MemberExpression") return staticName(c.property, c.computed);
	return null;
}

/**
 * For `expect(<arg>).[not.]toBe(…)`, the expect argument.
 * @param {object} call - The matcher call.
 * @returns {object|null} Argument node.
 */
function expectSubject(call) {
	if (call.callee.type !== "MemberExpression") return null;
	let obj = call.callee.object;
	while (obj && obj.type === "MemberExpression" && ["not", "resolves", "rejects"].includes(staticName(obj.property, obj.computed)))
		obj = obj.object;
	if (obj && obj.type === "CallExpression" && obj.callee.type === "Identifier" && obj.callee.name === "expect")
		return obj.arguments[0] ?? null;
	return null;
}

/**
 * Whether a code literal sits where it is provably compared with an error's `.code`.
 * @param {object} node - String literal.
 * @param {object[]} ancestors - Ancestors.
 * @returns {boolean} True when provable.
 */
function isCodeComparison(node, ancestors) {
	const parent = ancestors[ancestors.length - 1];
	if (!parent) return false;
	if (parent.type === "BinaryExpression" && ["===", "!==", "==", "!="].includes(parent.operator)) {
		const other = parent.left === node ? parent.right : parent.left;
		return isCodeRead(other);
	}
	if (parent.type === "SwitchCase" && parent.test === node) {
		const sw = ancestors[ancestors.length - 2];
		return !!sw && sw.type === "SwitchStatement" && isCodeRead(sw.discriminant);
	}
	if (parent.type === "CallExpression" && parent.arguments.includes(node)) {
		const name = calleeName(parent);
		if (MATCHERS_VALUE.has(name) && parent.arguments[0] === node) return isCodeRead(expectSubject(parent));
		// A slothlet error's message starts with "[CODE]", so matching the message on the code is a code check.
		if ((name === "toThrow" || name === "toThrowError") && parent.arguments[0] === node) return true;
		if ((name === "toContain" || name === "toMatch") && parent.arguments[0] === node) return isMessageRead(expectSubject(parent));
		if (name === "toHaveProperty" && parent.arguments[1] === node) {
			const a0 = parent.arguments[0];
			return a0 && a0.type === "Literal" && a0.value === "code";
		}
		return false;
	}
	if (parent.type === "Property" && parent.value === node && !parent.computed && staticName(parent.key, false) === "code") {
		const obj = ancestors[ancestors.length - 2];
		const holder = ancestors[ancestors.length - 3];
		return (
			!!obj &&
			obj.type === "ObjectExpression" &&
			!!holder &&
			holder.type === "CallExpression" &&
			holder.arguments.includes(obj) &&
			MATCHERS_OBJECT.has(calleeName(holder))
		);
	}
	return false;
}

/**
 * Rewrite or report an error-code string literal.
 * @param {object} node - Literal.
 * @param {object[]} ancestors - Ancestors.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteCodeLiteral(node, ancestors, ctx) {
	const value = node.value;
	const id = `code|${value}`;
	if (CODE_REMOVED.has(value)) {
		ctx.result.manual(id, node.start, `"${value}" no longer exists in v4; update or remove the check.`);
		return;
	}
	const next = CODE_RENAMES.get(value);
	if (!next) return;
	if (isCodeComparison(node, ancestors) && ctx.editor.replace(node.start, node.end, quoteLike(ctx.code, node, next))) {
		ctx.result.rewrite(id, node.start, `"${value}" → "${next}"`);
		return;
	}
	ctx.result.manual(id, node.start, `"${value}" is "${next}" in v4 (not rewritten: not provably compared with an error's .code).`);
}

/**
 * A regular expression that is exactly an error code (`toThrow(/OLD_CODE/)`).
 * @param {object} node - Regex literal.
 * @param {object[]} ancestors - Ancestors.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteCodeRegex(node, ancestors, ctx) {
	const value = node.regex.pattern;
	const id = `code|${value}`;
	if (CODE_REMOVED.has(value)) {
		ctx.result.manual(id, node.start, `"${value}" no longer exists in v4; update or remove the check.`);
		return;
	}
	const next = CODE_RENAMES.get(value);
	if (!next) return;
	const parent = ancestors[ancestors.length - 1];
	const name = parent && parent.type === "CallExpression" ? calleeName(parent) : null;
	if (
		(name === "toThrow" || name === "toThrowError" || name === "toMatch") &&
		parent.arguments[0] === node &&
		ctx.editor.replace(node.start, node.end, `/${next}/${node.regex.flags}`)
	) {
		ctx.result.rewrite(id, node.start, `/${value}/ → /${next}/`);
		return;
	}
	ctx.result.manual(id, node.start, `"${value}" is "${next}" in v4 (not rewritten: not provably matched against an error).`);
}

/**
 * Whether a test expression proves `name` is a slothlet error.
 * @param {object} test - Condition.
 * @param {string} name - Identifier.
 * @returns {boolean} True when proven.
 */
function proves(test, name) {
	if (!test) return false;
	if (test.type === "LogicalExpression" && test.operator === "&&") return proves(test.left, name) || proves(test.right, name);
	if (test.type === "BinaryExpression" && test.operator === "instanceof") {
		const right =
			test.right.type === "MemberExpression"
				? staticName(test.right.property, test.right.computed)
				: test.right.type === "Identifier"
					? test.right.name
					: null;
		return test.left.type === "Identifier" && test.left.name === name && (right === "SlothletError" || right === "SlothletWarning");
	}
	if (test.type === "BinaryExpression" && (test.operator === "===" || test.operator === "==")) {
		const pairs = [
			[test.left, test.right],
			[test.right, test.left]
		];
		for (const [a, b] of pairs) {
			const read = a && a.type === "ChainExpression" ? a.expression : a;
			if (
				read &&
				read.type === "MemberExpression" &&
				read.object.type === "Identifier" &&
				read.object.name === name &&
				staticName(read.property, read.computed) === "code" &&
				b.type === "Literal" &&
				KNOWN_CODES.has(b.value)
			)
				return true;
		}
	}
	return false;
}

/**
 * Whether `node` is inside the branch a proving condition guards.
 * @param {object} node - The member.
 * @param {object[]} ancestors - Ancestors.
 * @param {string} name - Identifier.
 * @returns {boolean} True when proven.
 */
function guarded(node, ancestors, name) {
	let child = node;
	for (let i = ancestors.length - 1; i >= 0; i--) {
		const a = ancestors[i];
		if ((a.type === "IfStatement" || a.type === "ConditionalExpression") && a.consequent === child && proves(a.test, name)) return true;
		if (a.type === "LogicalExpression" && a.operator === "&&" && a.right === child && proves(a.left, name)) return true;
		if (/Function/.test(a.type)) return false;
		child = a;
	}
	return false;
}

/**
 * `.context` on a slothlet error → `.details`.
 * @param {object} node - MemberExpression.
 * @param {object[]} ancestors - Ancestors.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteErrorContext(node, ancestors, ctx) {
	if (node.computed || node.property.type !== "Identifier" || node.object.type !== "Identifier") return;
	const prop = node.property.name;
	const name = node.object.name;
	if (prop === "originalError") {
		ctx.result.manual("data|error.originalError", node.property.start, "originalError is gone in v4: read the standard `cause`.");
		return;
	}
	if (prop === "suppressConsole" && name === "SlothletWarning") {
		ctx.result.manual("data|@cldmv/slothlet/errors#SlothletWarning.suppressConsole", node.property.start);
		return;
	}
	if (prop !== "context") return;
	if (guarded(node, ancestors, name)) {
		if (ctx.editor.replace(node.property.start, node.property.end, "details"))
			ctx.result.rewrite("data|error.context", node.property.start, `${name}.context → ${name}.details`);
		return;
	}
	const isCatchParam = ancestors.some((a) => a.type === "CatchClause" && a.param && a.param.type === "Identifier" && a.param.name === name);
	if (isCatchParam || ERROR_NAMES.test(name)) {
		ctx.result.manual(
			"data|error.context",
			node.property.start,
			`If ${name} is a SlothletError or SlothletWarning, ${name}.context is ${name}.details in v4.`
		);
	}
}

/**
 * A matcher object describing a slothlet error: `{ code: "<slothlet code>", context: {…} }` → `details`.
 * @param {object} node - ObjectExpression.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteErrorShape(node, ctx) {
	let code = false;
	let context = null;
	for (const p of node.properties) {
		if (p.type !== "Property" || p.computed || p.method) continue;
		const name = staticName(p.key, false);
		if (name === "code" && p.value.type === "Literal" && KNOWN_CODES.has(p.value.value)) code = true;
		if (name === "context") context = p;
	}
	if (!code || !context) return;
	const ok = context.shorthand
		? ctx.editor.replace(context.start, context.end, "details: context")
		: ctx.editor.replace(context.key.start, context.key.end, ctx.json ? '"details"' : "details");
	if (ok) ctx.result.rewrite("data|error.context", context.key.start, "context → details (error shape with a slothlet code)");
}

/**
 * `new SlothletError(code, context, originalError, …)` — the constructor takes (code, details, { cause }).
 * @param {object} node - NewExpression.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function checkErrorConstructor(node, ctx) {
	const callee =
		node.callee.type === "MemberExpression"
			? flattenChain(node.callee).segments.at(-1)?.name
			: node.callee.type === "Identifier"
				? node.callee.name
				: null;
	if (callee !== "SlothletError" && callee !== "SlothletWarning") return;
	const third = node.arguments[2];
	const v4Options =
		node.arguments.length === 3 &&
		third.type === "ObjectExpression" &&
		third.properties.every((p) => p.type === "Property" && !p.computed && staticName(p.key, false) === "cause");
	if (node.arguments.length >= 3 && !v4Options)
		ctx.result.manual("data|new SlothletError(code, context, originalError, flags)", node.start);
}
