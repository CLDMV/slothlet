/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_collisions/pair/fnsolo/fnsolo.mjs
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
 * @fileoverview No-collision twin of pair/fnprop/fnprop.mjs: the same callable folder module with
 * members on its own function (a plain value, a live getter, a self-reference), but with no file
 * beside the folder, so nothing collides. Its surface is the reference the collision case must match.
 * @module api_test_collisions.pair.fnsolo.fnsolo
 * @memberof module:api_test_collisions
 */

/**
 * Folder callable; holds the slot alone.
 * @returns {string} Identifier proving which callable answered.
 * @example
 * folderFnsolo(); // "folder-fnsolo"
 */
export default function folderFnsolo() {
	return "folder-fnsolo";
}

/** @type {string} Member carried on the function itself, not exported by name. */
folderFnsolo.tag = "solo-fn-tag";

/** @type {number} Backing state for the live accessor below. */
let reads = 0;

// A live accessor on the function: every read runs the getter, so two reads see two values.
Object.defineProperty(folderFnsolo, "live", {
	get() {
		reads += 1;
		return reads;
	},
	enumerable: true,
	configurable: true
});

/** @type {Function} Self-reference: the member is the module's own callable. */
folderFnsolo.me = folderFnsolo;

/** @type {string} Ordinary named export. */
export const origin = "dir";
