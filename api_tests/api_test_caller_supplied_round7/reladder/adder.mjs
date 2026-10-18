/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7/reladder/adder.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that adds another from a folder named relative to a helper of its own (#597).
 *
 * @module api_tests/api_test_caller_supplied_round7/reladder/adder
 */

import { addFrom } from "../relhelp/add.mjs";

/**
 * Add a module from a folder named relative to the helper that asks for the add.
 * @param {string} folder - The folder, relative to the helper.
 * @param {string} name - Where to mount it, and its moduleID's stem.
 * @returns {Promise<string>} What the module's own call reads after the add settles.
 * @public
 * @example
 * await api.reladder.adder.addRelative("lib", "relplug"); // "s3cret"
 */
export function addRelative(folder, name) {
	return addFrom(folder, name);
}
