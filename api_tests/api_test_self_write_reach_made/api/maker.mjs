/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_write_reach_made/api/maker.mjs
 *	@Date: 2026-11-15T11:38:09-08:00 (1794771489)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:47-08:00 (1795868987)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that defines a member on a folder it reaches through `self` (the api root, or the `zz` mount)
 * and reads it back: the read is decided by the rules for this leaf at the member's path, as any read of data is.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The folder a change is made on.
 * @param {"root"|"zz"} where - The api root, or the `zz` mount.
 * @returns {object} The folder, as `self` gives it.
 */
const folder = (where) => (where === "root" ? self : self.zz);

/**
 * Run a step and report what it gave, or the error it threw as its code and message.
 * @param {function(): *} step - The step.
 * @returns {*} The step's value, or `{ code, message }`.
 */
function attempt(step) {
	try {
		return step();
	} catch (error) {
		return { code: error?.code ?? error?.name, message: String(error?.message) };
	}
}

/**
 * Define a member, read it back and list the folder, all from this leaf.
 * @param {"root"|"zz"} where - The folder.
 * @returns {{change: *, read: *, listed: *}} What each step gave.
 * @example
 * define("root");
 */
export function define(where) {
	return {
		change: attempt(() => {
			Object.defineProperty(folder(where), "baseDefined", { value: 7, enumerable: true, configurable: true, writable: true });
			return "done";
		}),
		read: attempt(() => folder(where).baseDefined),
		listed: attempt(() => Object.keys(folder(where)).includes("baseDefined"))
	};
}

/**
 * Assign a member, read it back and list the folder, all from this leaf.
 * @param {"root"|"zz"} where - The folder.
 * @returns {{change: *, read: *, listed: *}} What each step gave.
 * @example
 * assign("root");
 */
export function assign(where) {
	return {
		change: attempt(() => {
			folder(where).baseAssigned = 8;
			return "done";
		}),
		read: attempt(() => folder(where).baseAssigned),
		listed: attempt(() => Object.keys(folder(where)).includes("baseAssigned"))
	};
}
