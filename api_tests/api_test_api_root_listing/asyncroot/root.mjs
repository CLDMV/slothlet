/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_root_listing/asyncroot/root.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T00:00:00-08:00 (1794643200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The root's only file with a default-export function, with a member of every primitive kind, an object
 * and a function beside it.
 * @module api_test_api_root_listing/asyncroot/root
 */

import { self } from "@cldmv/slothlet/runtime";

/** A number. */
export const rnum = 1;
/** A string. */
export const rstr = "one";
/** A boolean. */
export const rbool = false;
/** Null. */
export const rnull = null;
/** Undefined. */
export const rundef = undefined;
/** A bigint. */
export const rbig = 1n;
/** A symbol. */
export const rsym = Symbol.for("slothlet-root-listing-member");
/** An object of data. */
export const rdata = { x: 1, y: { z: 2 } };

/**
 * Read a member at a path through `self`, as this file's own code.
 * @param {string} path - The path.
 * @returns {string} The type of what it read, or the code of what it threw.
 */
export function rfn(path) {
	let node = self;
	try {
		for (const segment of path.split(".")) node = node[segment];
		return typeof node;
	} catch (error) {
		return error?.code ?? "threw";
	}
}

/**
 * The root's own function.
 * @returns {string} A marker.
 */
export default async function root() {
	return "root";
}
