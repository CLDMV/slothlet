/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_member_exports/runtime/probe/writer.mjs
 *	@Date: 2026-11-25T13:17:45-08:00 (1795641465)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:40:45-08:00 (1795642845)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code that assigns a member named for one of the wrapper's own methods through `self`, on a
 * namespace it owns, then makes the node create a child.
 * @module api_test_framework_member_exports.runtime.probe.writer
 */

import { self } from "@cldmv/slothlet/runtime";
import { note } from "../../lib/capture.mjs";

/** A namespace the writer places members on. */
export const target = { first: { leaf: 1 } };

/**
 * Assign `name` on `target`, then a member that makes the node create a child.
 * @param {string} name - The member name to assign.
 * @returns {Promise<string>} "assigned", or the refusal's code.
 */
export async function plant(name) {
	try {
		self.probe.writer.target[name] = function planted() {
			note(`planted ${name}`);
			return undefined;
		};
		self.probe.writer.target.later = { nested: { leaf: 2 } };
		void self.probe.writer.target.later.nested;
		return "assigned";
	} catch (error) {
		return `THREW:${error.code}`;
	}
}

export { calls } from "../../lib/capture.mjs";
