/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_default_data/owner/owner.mjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The same data as the `single` files' default exports, as named exports of one file, so the two routes
 * to it can be compared.
 * @module api_test_api_node_default_data/owner
 */

/** A class of the module's own. */
class Item {
	constructor() {
		this.one = { n: 1 };
	}
}

/** @type {Map<string, object>} */
export const dmap = new Map([["one", { n: 1 }]]);

/** @type {Set<object>} */
export const dset = new Set([{ n: 1 }]);

/** @type {object[]} */
export const dlist = [{ n: 1 }];

/** @type {object} */
export const dconfig = { one: { n: 1 }, level: 2 };

/** @type {Item} */
export const ditem = new Item();

/** @type {Date} */
export const ddate = new Date(7);

/** @type {RangeError} */
export const derr = new RangeError("out of range", { cause: { code: 7 } });

/**
 * Data with an object member and a primitive member, for listing checks.
 * @type {object}
 */
export const config = { nested: { a: 1 }, prim: 2, open: { b: 3 } };

/**
 * What the owner's own objects hold, as the owner reads them.
 * @returns {number[]} The `n` of the object each of its collections holds.
 */
export const held = () => [dmap.get("one").n, [...dset][0].n, dlist[0].n, dconfig.one.n, ditem.one.n];

/**
 * What the owner's map, set and date hold, as the owner reads them.
 * @returns {{map: number, set: number, date: number}} The map's and the set's sizes and the date's time value.
 */
export const sizes = () => ({ map: dmap.size, set: dset.size, date: ddate.getTime() });
