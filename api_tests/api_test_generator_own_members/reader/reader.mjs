/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_generator_own_members/reader/reader.mjs
 *	@Date: 2026-11-25T02:34:03-08:00 (1795602843)
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
 * @fileoverview A module that is handed another module's generator objects through `self`.
 * @module api_test_generator_own_members/reader
 */

import { self } from "@cldmv/slothlet/runtime";
import { describe, exercise, exerciseAsync } from "../lib/exercise.mjs";

/**
 * Describe a generator object the other module makes.
 * @param {string} state - How far it is closed.
 * @param {boolean} isAsync - Whether to take the async one.
 * @returns {Promise<object>} The description.
 */
export async function look(state, isAsync) {
	return describe(await (isAsync ? self.gen.makeAsync(state) : self.gen.make(state)));
}

/**
 * Write and step a generator object the other module makes.
 * @param {string} state - How far it is closed.
 * @param {boolean} isAsync - Whether to take the async one.
 * @returns {Promise<Array<*>>} What each write and step answered.
 */
export async function use(state, isAsync) {
	return isAsync ? exerciseAsync(await self.gen.makeAsync(state)) : exercise(await self.gen.make(state));
}
