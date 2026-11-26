/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapper_member_names/top/probe/members.mjs
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
 * @fileoverview Top-level exports named like the members the wrapper's class chain carries without the framework's
 * prefix. Each is an ordinary member of the node.
 * @module api_test_wrapper_member_names.top.probe.members
 */

import { self } from "@cldmv/slothlet/runtime";
import { members, NAMES } from "../../lib/capture.mjs";

const made = members("top");

export const slothlet = made.slothlet;
export const SlothletError = made.SlothletError;
export const SlothletWarning = made.SlothletWarning;
export const clock = made.clock;
export const instanceID = made.instanceID;
export const createProxy = made.createProxy;
export const emitImplDiagnostic = made.emitImplDiagnostic;
export const emitImplCollision = made.emitImplCollision;
export const _applyNewImpl = made._applyNewImpl;

/** A plain member beside them. */
export const zeta = { leaf: 1 };

/**
 * Read a member through `self`, then add one and remove it again.
 * @returns {number} The member's leaf.
 */
export function touch() {
	self.probe.members.added = { nested: { leaf: 2 } };
	const leaf = self.probe.members.added.nested.leaf;
	delete self.probe.members.added;
	return self.probe.members.zeta.leaf + leaf;
}

/**
 * Call every member through `self`, as module code of this file.
 * @returns {Promise<string[]>} What each answered.
 */
export async function callAll() {
	const answers = [];
	for (const name of NAMES) answers.push(await self.probe.members[name]("arg"));
	return answers;
}

export { calls, reset } from "../../lib/capture.mjs";
