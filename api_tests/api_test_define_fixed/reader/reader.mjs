/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_define_fixed/reader/reader.mjs
 *	@Date: 2026-11-16T05:00:00-08:00 (1794834000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:55-08:00 (1795868875)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads and writes what another module locked on its node.
 * @module api_test_define_fixed/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a check, answering what it returned, or the code of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * Read and write beneath `owner.data.<key>`.
 * @param {string} key - The member.
 * @returns {Record<string, *>} Each route's answer.
 */
export function probe(key) {
	return {
		hidden: answer(() => self.owner.data[key].hidden),
		v: answer(() => self.owner.data[key].v),
		write: answer(() => {
			self.owner.data[key].v = 2;
			return "wrote";
		})
	};
}
