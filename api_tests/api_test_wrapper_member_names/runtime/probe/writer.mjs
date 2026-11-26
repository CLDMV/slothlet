/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapper_member_names/runtime/probe/writer.mjs
 *	@Date: 2026-11-25T14:25:24-08:00 (1795645524)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:05:12-08:00 (1795651512)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Assigns members named like the members the wrapper's class chain carries without the framework's
 * prefix, through `self`, on a namespace it owns, then makes the node create a child.
 * @module api_test_wrapper_member_names.runtime.probe.writer
 */

import { self } from "@cldmv/slothlet/runtime";
import { members, NAMES } from "../../lib/capture.mjs";

/** A namespace the writer places members on. */
export const target = { first: { leaf: 1 } };

/**
 * Assign every name on `target`, then a member that makes the node create a child.
 * @returns {string} "assigned", or the code of what was thrown.
 */
export function plant() {
	const made = members("runtime");
	try {
		for (const name of NAMES) self.probe.writer.target[name] = made[name];
		self.probe.writer.target.later = { nested: { leaf: 2 } };
		return `assigned:${self.probe.writer.target.later.nested.leaf + self.probe.writer.target.first.leaf}`;
	} catch (error) {
		return `THREW:${error.code ?? error.message}`;
	}
}

/**
 * Call every member through `self`, as module code of this file.
 * @returns {Promise<string[]>} What each answered.
 */
export async function callAll() {
	const answers = [];
	for (const name of NAMES) answers.push(await self.probe.writer.target[name]("arg"));
	return answers;
}

export { calls, reset } from "../../lib/capture.mjs";
