/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_collisions/pair/fnprop/fnprop.mjs
 *	@Date: 2026-11-16T20:00:00-08:00 (1794888000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:50-08:00 (1795868870)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Self-named callable folder module that puts a member on its own function. A callable
 * impl keeps its function's own properties on the function, so this member is not adopted as a child
 * of the folder's wrapper.
 * @module api_test_collisions.pair.fnprop.fnprop
 * @memberof module:api_test_collisions
 */

/**
 * Folder-side callable; yields the slot to the file under the default merge.
 * @returns {string} Identifier proving which callable answered.
 * @example
 * folderFnprop(); // "folder-fnprop"
 */
export default function folderFnprop() {
	return "folder-fnprop";
}

/** @type {string} Member carried on the function itself, not exported by name. */
folderFnprop.tag = "folder-fn-tag";

/** @type {number} Backing state for the live accessor below. */
let reads = 0;

// A live accessor on the function: every read runs the getter, so two reads see two values.
Object.defineProperty(folderFnprop, "live", {
	get() {
		reads += 1;
		return reads;
	},
	enumerable: true,
	configurable: true
});

/** @type {Function} Self-reference: the member is the module's own callable. */
folderFnprop.me = folderFnprop;

/** @type {string} Ordinary named export merged from the losing folder. */
export const origin = "dir";
