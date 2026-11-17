/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /packaging/slothlet-migrate/src/lib/chains.mjs
 *	@Date: 2026-11-16T16:06:02-08:00 (1794873962)
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
 * Whether `node` is the outermost member of its chain (its parent does not continue the chain).
 * @param {object} node - MemberExpression.
 * @param {object|undefined} parent - Parent node.
 * @returns {boolean} True for the chain top.
 */
export function isChainTop(node, parent) {
	return !(parent && parent.type === "MemberExpression" && parent.object === node);
}
