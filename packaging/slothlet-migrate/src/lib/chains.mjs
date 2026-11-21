/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/chains.mjs
 *	@Date: 2026-11-16T16:06:02-08:00 (1794873962)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:26:22-08:00 (1794929182)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Member-chain helpers: flatten `a.b.c` and find the part after `.slothlet.`.
 * @module @cldmv/slothlet-migrate/lib/chains
 * @internal
 */

import { staticName } from "./source.mjs";

/**
 * @typedef {object} ChainSegment
 * @property {string|null} name - Static property name (null when dynamic).
 * @property {object} member - The MemberExpression whose property this is.
 * @property {object} property - The property node.
 * @property {boolean} plain - Written as `.name` (not computed, not optional).
 */

/**
 * Flatten a member chain from its root outwards.
 * @param {object} node - A MemberExpression (or ChainExpression wrapping one).
 * @returns {{ root: object, segments: ChainSegment[] }} Root object node and the property segments.
 */
export function flattenChain(node) {
	const segments = [];
	let cur = node.type === "ChainExpression" ? node.expression : node;
	while (cur && cur.type === "MemberExpression") {
		segments.unshift({
			name: staticName(cur.property, cur.computed),
			member: cur,
			property: cur.property,
			plain: !cur.computed && !cur.optional
		});
		cur = cur.object;
	}
	return { root: cur, segments };
}

/**
 * The part of a chain after a `.slothlet` property: `api.slothlet.diag.getAPI` → ["diag", "getAPI"].
 * @param {object} node - A MemberExpression.
 * @returns {{ segments: ChainSegment[], slothlet: ChainSegment }|null} The tail, or null when the chain has no `.slothlet`.
 */
export function slothletTail(node) {
	const { segments } = flattenChain(node);
	const index = segments.findIndex((s) => s.name === "slothlet");
	if (index < 0) return null;
	return { segments: segments.slice(index + 1), slothlet: segments[index] };
}

/**
 * Like {@link slothletTail}, but also follows a chain rooted at a local alias of a `.slothlet` chain
 * (`const mm = api.slothlet.api.modules; mm.discover(…)`). The alias's own segments come first and
 * have no property node of their own; `aliasLen` says how many there are.
 * @param {object} node - A MemberExpression.
 * @param {Map<string, { segs: string[], proven: boolean }>|undefined} aliases - Aliases the file declares.
 * @returns {{ segments: Array<ChainSegment|{ name: string, member: null, property: null, plain: true }>, aliasLen: number, proven: boolean, alias: string }|null} The virtual tail.
 */
export function aliasedTail(node, aliases) {
	if (!aliases || !aliases.size) return null;
	const { root, segments } = flattenChain(node);
	if (!root || root.type !== "Identifier" || !segments.length) return null;
	const alias = aliases.get(root.name);
	if (!alias) return null;
	const own = alias.segs.map((name) => ({ name, member: null, property: null, plain: true }));
	return { segments: [...own, ...segments], aliasLen: own.length, proven: alias.proven, alias: root.name };
}

/**
 * Whether `node` is the outermost member of its chain (its parent does not continue the chain).
 * @param {object} node - MemberExpression.
 * @param {object|undefined} parent - Parent node.
 * @returns {boolean} True for the chain top.
 */
export function isChainTop(node, parent) {
	return !(parent && parent.type === "MemberExpression" && parent.object === node);
}
