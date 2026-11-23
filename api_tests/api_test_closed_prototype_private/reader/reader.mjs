/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_closed_prototype_private/reader/reader.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T00:00:00-08:00 (1795334400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module reading another module's classes, whose prototypes hold private members, through `self`.
 * @module api_test_closed_prototype_private/reader
 */
import { self } from "@cldmv/slothlet/runtime";
import * as probes from "../../api_test_closed_prototype_private_lib/probes.mjs";

/**
 * How the owner's class's prototype lists, read through `self`.
 * @param {string} name - The class.
 * @returns {object} The answers.
 */
export function listing(name) {
	return probes.listing(self.owner, name);
}

/**
 * What this module reads of the owner's class's private members through `self`.
 * @param {string} name - The class.
 * @returns {object} The answers.
 */
export function privacy(name) {
	return probes.privacy(self.owner, name);
}
