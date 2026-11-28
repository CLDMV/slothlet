/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/methods.mjs
 *	@Date: 2026-11-16T16:10:04-08:00 (1794874204)
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
 * @fileoverview `api.slothlet.*` / `self.slothlet.*` method renames, moves and folds in member
 * chains, the per-method argument rewrites, and permission rule targets that name a method path.
 * @module @cldmv/slothlet-migrate/lib/methods
 * @internal
 */

import { METHODS } from "./data.mjs";
import { aliasedTail, isChainTop, slothletTail } from "./chains.mjs";
import { q } from "./config.mjs";
import { ARG_INDEX, reloadExtra, rewriteApiAdd, rewriteHookPattern, rewriteOptions } from "./options.mjs";
import { isStringLiteral, quoteLike, stringValue } from "./source.mjs";

/** Rows that need more than a path swap, and what to do with them. */
const SPECIAL = {
	"diag.owner": "owner-call",
	"permissions.control.enable": "mode-call",
	"permissions.control.disable": "mode-call",
	"permissions.control.enabled": "mode-compare",
	"permissions.control.readGatingEnabled": "gating-read",
	"permissions.control.mode": "mode-accessor",
	"metadata.getForVersion": "manual",
	"metadata.setForVersion": "manual",
	"metadata.getFor": "rename-info",
	"metadata.get": "info",
	"metadata.set": "info",
	"metadata.remove": "info",
	"api.remove": "none"
};

/** Longest-first list of v3 method paths. */
const PATHS = [...METHODS.keys()].sort((a, b) => b.split(".").length - a.split(".").length || b.length - a.length);

/**
 * Match the longest v3 method path at the start of a chain tail.
 * @param {Array<{ name: string|null }>} tail - Segments after `.slothlet`.
 * @returns {{ path: string, length: number }|null} Match.
 */
export function matchMethod(tail) {
	for (const path of PATHS) {
		const segs = path.split(".");
		if (segs.length > tail.length) continue;
		if (segs.every((s, i) => tail[i].name === s)) return { path, length: segs.length };
	}
	return null;
}

/**
 * Whether the node at the end of a member chain is being written (assignment, update, delete).
 * @param {object} node - Member node.
 * @param {object|undefined} parent - Parent.
 * @returns {boolean} True for a write target.
 */
function isWriteTarget(node, parent) {
	if (!parent) return false;
	if (parent.type === "AssignmentExpression" && parent.left === node) return true;
	if (parent.type === "UpdateExpression") return true;
	if (parent.type === "UnaryExpression" && parent.operator === "delete") return true;
	return false;
}

/**
 * Rewrite one chain top: method path renames and folds, then hand the call to the argument rewriters.
 * @param {object} node - MemberExpression at the top of its chain.
 * @param {object[]} ancestors - Ancestors (nearest last).
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteChain(node, ancestors, ctx) {
	const parent = ancestors[ancestors.length - 1];
	if (!isChainTop(node, parent)) return;
	const found = slothletTail(node) ?? aliasedTail(node, ctx.aliases);
	if (!found || !found.segments.length) return;
	const tail = found.segments;
	const aliasLen = found.aliasLen ?? 0;
	const match = matchMethod(tail);
	if (aliasLen) {
		rewriteAliased(node, parent, found, match, ctx);
		return;
	}
	if (!match) {
		const path = tail.map((t) => t.name).join(".");
		if (parent && parent.type === "CallExpression" && parent.callee === node && tail.every((t) => t.plain) && CALL_PATHS.has(path))
			defer(ctx, parent, () => rewriteCallArgs(path, parent, ctx));
		return;
	}
	const e = METHODS.get(match.path);
	const matched = tail.slice(0, match.length);
	const rest = tail.slice(match.length);
	const last = matched[matched.length - 1];
	const call = parent && parent.type === "CallExpression" && parent.callee === node && rest.length === 0 ? parent : null;
	const offset = matched[0].property.start;
	const special = SPECIAL[match.path];
	const plain = matched.every((s) => s.plain);
	const swap = (text) => ctx.editor.replace(matched[0].property.start, last.property.end, text);
	const newPath = e.new ? e.new.slice("api.slothlet.".length) : null;

	if (e.action === "new") return;
	if (special === "none") {
		if (call) defer(ctx, call, () => rewriteCallArgs(match.path, call, ctx));
		return;
	}
	if (special === "info") {
		if (rest.length === 0) ctx.result.info(e.id, offset);
		return;
	}
	if (!plain) {
		if (rest.length === 0 || e.action !== "behaviour") ctx.result.manual(e.id, offset);
		return;
	}
	if (special === "manual") {
		ctx.result.manual(e.id, offset);
		return;
	}
	if (special === "owner-call") {
		if (rest.length) return; // diag.owner.get / diag.owner.list are already v4
		if (call && swap("diag.owner.get")) ctx.result.rewrite(e.id, offset, "diag.owner(path) → diag.owner.get(path)");
		else ctx.result.manual(e.id, offset);
		return;
	}
	if (special === "mode-call") {
		const value = match.path.endsWith("enable") ? "on" : "off";
		if (
			call &&
			call.arguments.length === 0 &&
			ctx.editor.replace(
				matched[0].property.start,
				call.end,
				`${matched
					.slice(0, -1)
					.map((s) => s.name)
					.join(".")}.mode(${q(ctx, value)})`
			)
		) {
			ctx.result.rewrite(e.id, offset, `${match.path}() → permissions.control.mode("${value}")`);
		} else ctx.result.manual(e.id, offset);
		return;
	}
	if (special === "mode-compare") {
		if (rest.length || call || isWriteTarget(node, parent)) {
			ctx.result.manual(e.id, offset);
			return;
		}
		const before = ctx.editor.slice(node.start, matched[0].property.start);
		const bare = `${before}${matched
			.slice(0, -1)
			.map((s) => s.name)
			.join(".")}.mode() === ${q(ctx, "on")}`;
		const text = standsAlone(node, parent) ? bare : `(${bare})`;
		if (ctx.editor.replace(node.start, node.end, text)) ctx.result.rewrite(e.id, offset, 'control.enabled → (control.mode() === "on")');
		else ctx.result.manual(e.id, offset);
		return;
	}
	if (special === "gating-read") {
		if (rest.length || call || isWriteTarget(node, parent)) {
			ctx.result.manual(e.id, offset);
			return;
		}
		if (swap("permissions.control.gating.read()")) ctx.result.rewrite(e.id, offset, "control.readGatingEnabled → control.gating.read()");
		else ctx.result.manual(e.id, offset);
		return;
	}
	if (special === "mode-accessor") {
		if (rest.length || call) return; // already a call (v4) or a deeper read
		if (isWriteTarget(node, parent)) {
			ctx.result.manual(e.id, offset, 'control.mode is a function in v4: call control.mode("on" | "off") instead of assigning.');
			return;
		}
		if (ctx.editor.replace(last.property.end, last.property.end, "()")) ctx.result.rewrite(e.id, offset, "control.mode → control.mode()");
		return;
	}
	if (!newPath) {
		ctx.result.manual(e.id, offset);
		return;
	}
	if (newPath === match.path) return;
	if (swap(newPath)) {
		ctx.result.rewrite(
			e.id,
			offset,
			`slothlet.${match.path} → slothlet.${newPath}`,
			match.path === "permissions.addRule" ? { also: ["option|api.slothlet.permissions.addRule(rule)"] } : undefined
		);
		if (special === "rename-info")
			ctx.result.info(
				e.id,
				offset,
				"metadata.get is synchronous in v4 and returns user metadata only; system facts (file, path, module) come from api.slothlet.node(target)."
			);
	} else ctx.result.manual(e.id, offset);
	if (call) defer(ctx, call, () => rewriteCallArgs(match.path, call, ctx));
}

/**
 * A chain rooted at a local alias of a `.slothlet` chain. A plain rename whose changed segments all
 * sit after the alias is applied there; anything else is reported (the alias's own declaration is
 * not touched), and so is every use of an alias the tool cannot prove constant.
 * @param {object} node - MemberExpression at the top of its chain.
 * @param {object|undefined} parent - Parent.
 * @param {{ segments: object[], aliasLen: number, proven: boolean, alias: string }} found - The virtual tail.
 * @param {{ path: string, length: number }|null} match - Method path match over the virtual tail.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
function rewriteAliased(node, parent, found, match, ctx) {
	const { segments: tail, aliasLen } = found;
	const real = tail.slice(aliasLen);
	const call = parent && parent.type === "CallExpression" && parent.callee === node ? parent : null;
	if (!match) {
		const path = tail.map((t) => t.name).join(".");
		if (found.proven && call && tail.every((t) => t.plain) && CALL_PATHS.has(path))
			defer(ctx, call, () => rewriteCallArgs(path, call, ctx));
		return;
	}
	const e = METHODS.get(match.path);
	if (e.action === "new") return;
	const offset = (real[0] ?? tail[tail.length - 1]).property?.start ?? node.start;
	const special = SPECIAL[match.path];
	if (special === "none") {
		if (found.proven && call) defer(ctx, call, () => rewriteCallArgs(match.path, call, ctx));
		return;
	}
	if (special === "info") return;
	const newPath = e.new ? e.new.slice("api.slothlet.".length) : null;
	const oldSegs = match.path.split(".");
	const newSegs = newPath ? newPath.split(".") : [];
	const rest = tail.slice(match.length);
	const sameHead = newPath !== null && oldSegs.slice(0, aliasLen).join(".") === newSegs.slice(0, aliasLen).join(".");
	const noop = newPath === match.path && !special;
	if (noop) {
		if (found.proven && call && rest.length === 0) defer(ctx, call, () => rewriteCallArgs(match.path, call, ctx));
		return;
	}
	const hand = `${match.path} is called through \`${found.alias}\`, an alias of a slothlet chain; ${
		newPath ? `in v4 it is slothlet.${newPath}` : "it is removed in v4"
	}. Edit the call by hand.`;
	const swappable =
		found.proven &&
		!special &&
		newPath &&
		match.length > aliasLen &&
		sameHead &&
		real.slice(0, match.length - aliasLen).every((s) => s.plain);
	if (!swappable) {
		ctx.result.manual(e.id, offset, hand);
		return;
	}
	const matched = real.slice(0, match.length - aliasLen);
	const text = newSegs.slice(aliasLen).join(".");
	if (ctx.editor.replace(matched[0].property.start, matched[matched.length - 1].property.end, text)) {
		ctx.result.rewrite(e.id, offset, `slothlet.${match.path} → slothlet.${newPath}`);
		if (call && rest.length === 0) defer(ctx, call, () => rewriteCallArgs(match.path, call, ctx));
	} else ctx.result.manual(e.id, offset, hand);
}

/**
 * Whether an expression can be replaced by a comparison without parentheses.
 * @param {object} node - Expression.
 * @param {object|undefined} parent - Parent.
 * @returns {boolean} True when no parentheses are needed.
 */
function standsAlone(node, parent) {
	if (!parent) return false;
	if ((parent.type === "IfStatement" || parent.type === "WhileStatement" || parent.type === "DoWhileStatement") && parent.test === node)
		return true;
	if (parent.type === "VariableDeclarator" && parent.init === node) return true;
	if (parent.type === "ReturnStatement" || parent.type === "ExpressionStatement") return true;
	if ((parent.type === "CallExpression" || parent.type === "NewExpression") && parent.arguments.includes(node)) return true;
	if (parent.type === "Property" && parent.value === node) return true;
	if (parent.type === "ArrayExpression") return true;
	return false;
}

/** Method paths whose arguments have rewrites even though the method keeps its name. */
const CALL_PATHS = new Set([
	"api.add",
	"api.remove",
	"api.leaves",
	"api.modules.discover",
	"hook.on",
	"permissions.principal.register",
	"reload"
]);

/**
 * Queue an argument rewrite; queued work runs smallest node first, after every in-place rename.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @param {object} node - Node whose range the work may replace.
 * @param {() => void} run - Work.
 * @returns {void}
 */
export function defer(ctx, node, run) {
	ctx.deferred.push({ size: node.end - node.start, start: node.start, run });
}

/**
 * Argument rewrites for a call of a v3 method path.
 * @param {string} path - v3 method path (below `api.slothlet.`).
 * @param {object} call - CallExpression.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteCallArgs(path, call, ctx) {
	const args = call.arguments;
	if (path === "api.add") return rewriteApiAdd(call, ctx);
	if (path === "api.remove") {
		if (args.length !== 2) return;
		const [a, b] = args;
		const id = "option|api.slothlet.api.remove(pathOrModuleId, apiPath)";
		const aId = isStringLiteral(a) && ctx.moduleIds.has(stringValue(a));
		const bId = isStringLiteral(b) && ctx.moduleIds.has(stringValue(b));
		if (isStringLiteral(a) && isStringLiteral(b) && aId && !bId) {
			// The first argument is a module id this file mounts with and the second is not: v3 order.
			const text = `${ctx.editor.slice(b.start, b.end)}, ${ctx.editor.slice(a.start, a.end)}`;
			if (ctx.editor.replace(a.start, b.end, text))
				ctx.result.rewrite(
					id,
					a.start,
					`remove("${stringValue(a)}", "${stringValue(b)}") → remove("${stringValue(b)}", "${stringValue(a)}")`,
					{ also: ["method|api.slothlet.api.remove"] }
				);
			return;
		}
		if (bId && !aId) return; // already v4 order: remove(apiPath, moduleID)
		ctx.result.manual(
			id,
			a.start,
			"If this call was written for v3, remove(moduleID, apiPath) is remove(apiPath, moduleID) in v4: swap the two arguments. (Not rewritten: the tool cannot tell which argument is the module id.)",
			{ also: ["method|api.slothlet.api.remove"] }
		);
		return;
	}
	if (path === "hook.on") {
		if (args[0]) rewriteHookPattern(args[0], ctx);
		if (args[2]) rewriteOptions(args[2], "hook.on", 2, ctx);
		return;
	}
	if (path === "reload") {
		if (args[0]) rewriteOptions(args[0], "reload", 0, ctx, { extra: reloadExtra(ctx) });
		return;
	}
	const positions = ARG_INDEX[path];
	if (!positions) return;
	for (const index of Object.values(positions)) {
		if (args[index] && args[index].type !== "SpreadElement") rewriteOptions(args[index], path, index, ctx);
	}
}

/**
 * Glob → RegExp for rule targets (`*` one segment, `**` any depth).
 * @param {string} glob - Pattern.
 * @returns {RegExp} Matcher.
 */
function globToRegExp(glob) {
	let out = "";
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i];
		if (c === "*" && glob[i + 1] === "*") {
			out += ".*";
			i++;
		} else if (c === "*") out += "[^.]*";
		else if (c === "?") out += "[^.]";
		else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`^${out}$`);
}

/**
 * Rewrite a permission rule target string that names a renamed `slothlet.*` method path.
 * Exact paths (optionally followed by `.*` / `.**`) are rewritten; folded methods and globs whose
 * coverage shifts are reported (rewriting them could widen or narrow a rule silently).
 * @param {object} node - The string literal.
 * @param {import("./config.mjs").RewriteContext} ctx - Context.
 * @returns {void}
 */
export function rewriteRuleTarget(node, ctx) {
	const raw = stringValue(node);
	const colon = raw.indexOf(":");
	const target = colon >= 0 ? raw.slice(0, colon) : raw;
	const suffix = colon >= 0 ? raw.slice(colon) : "";
	if (!target.startsWith("slothlet.")) return;
	const segs = target.slice("slothlet.".length).split(".");
	const glob = /[*?]/.test(target);
	const literal = [];
	for (const s of segs) {
		if (/[*?]/.test(s)) break;
		literal.push(s);
	}
	const match = matchMethod(literal.map((name) => ({ name })));
	if (match) {
		const e = METHODS.get(match.path);
		const rest = segs.slice(match.length);
		const restIsGlob = rest.length === 0 || rest.every((s) => s === "*" || s === "**");
		const newPath = e.new ? e.new.slice("api.slothlet.".length) : null;
		if (e.action === "new" || e.action === "behaviour" || (newPath === match.path && newPath !== null)) return;
		if (match.path === "diag.owner" && rest.length && !restIsGlob) return; // diag.owner.get / list
		if (newPath && restIsGlob && (e.action === "rename" || e.action === "move" || e.action === "remove")) {
			const next = `slothlet.${[newPath, ...rest].join(".")}${suffix}`;
			if (ctx.editor.replace(node.start, node.end, quoteLike(ctx.code, node, next))) {
				ctx.result.rewrite(e.id, node.start, `rule target "${raw}" → "${next}"`);
				return;
			}
		}
		ctx.result.manual(
			e.id,
			node.start,
			`rule target "${raw}" names v3 slothlet.${match.path}${newPath ? ` (v4: slothlet.${newPath})` : ""}; rewrite the rule by hand${e.action === "fold" ? " (the v4 method also covers other calls, so the rule would match more)" : ""}.`
		);
		return;
	}
	if (!glob) return;
	const re = globToRegExp(target);
	for (const [path, e] of METHODS) {
		if (!e.new || e.action === "behaviour" || e.action === "new") continue;
		const newPath = e.new.slice("api.slothlet.".length);
		if (re.test(`slothlet.${path}`) && !re.test(`slothlet.${newPath}`)) {
			ctx.result.manual(
				e.id,
				node.start,
				`rule target "${raw}" matched v3 slothlet.${path}, which is slothlet.${newPath} in v4 and no longer matches; adjust the pattern.`
			);
		}
	}
}

/**
 * Whether an object literal looks like a permission rule ({ target, effect }).
 * @param {object} node - ObjectExpression.
 * @returns {object|null} The target value node when it is a static string.
 */
export function ruleTargetNode(node) {
	let target = null;
	let effect = false;
	for (const p of node.properties) {
		if (p.type !== "Property" || p.computed) continue;
		const name = p.key.type === "Identifier" ? p.key.name : p.key.value;
		if (name === "target" && isStringLiteral(p.value)) target = p.value;
		if (name === "effect") effect = true;
	}
	return target && effect ? target : null;
}
