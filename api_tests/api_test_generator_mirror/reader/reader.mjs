/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_generator_mirror/reader/reader.mjs
 *	@Date: 2026-11-25T07:53:47-08:00 (1795622027)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:08-08:00 (1795868888)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that is handed another module's generator objects through `self` and runs the same script
 * on them that the test runs as the host.
 * @module api_test_generator_mirror/reader
 */

import { self } from "@cldmv/slothlet/runtime";
import { script } from "../lib/script.mjs";

/**
 * Run the script on the generator module, reached through `self`.
 * @param {boolean} isAsync - Whether to take async generators.
 * @returns {Promise<Array<*>>} What each line of the script answered.
 */
export async function run(isAsync) {
	return script(self.gen, isAsync);
}
