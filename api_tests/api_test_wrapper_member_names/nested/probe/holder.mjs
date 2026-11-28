/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapper_member_names/nested/probe/holder.mjs
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
 * @fileoverview An exported object whose own members are named like the members the wrapper's class chain carries
 * without the framework's prefix. Each is an ordinary member of the object's node.
 * @module api_test_wrapper_member_names.nested.probe.holder
 */

import { self } from "@cldmv/slothlet/runtime";
import { members, NAMES } from "../../lib/capture.mjs";

/** The members, and a plain one beside them. */
export const box = { ...members("nested"), zeta: { leaf: 1 } };

/**
 * Read a member of the box through `self`, then add one to it and remove it again.
 * @returns {number} The member's leaf.
 */
export function touch() {
	self.probe.holder.box.added = { nested: { leaf: 2 } };
	const leaf = self.probe.holder.box.added.nested.leaf;
	delete self.probe.holder.box.added;
	return self.probe.holder.box.zeta.leaf + leaf;
}

/**
 * Call every member through `self`, as module code of this file.
 * @returns {Promise<string[]>} What each answered.
 */
export async function callAll() {
	const answers = [];
	for (const name of NAMES) answers.push(await self.probe.holder.box[name]("arg"));
	return answers;
}

export { calls, reset } from "../../lib/capture.mjs";
