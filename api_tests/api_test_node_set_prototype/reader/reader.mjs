/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_node_set_prototype/reader/reader.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:39:39-08:00 (1794778779)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that tries to give another module's nodes a prototype through `self`.
 * @module api_test_node_set_prototype/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Give one of the base's nodes a prototype.
 * @param {string} which - `"em"`, `"inst"`, `"leaf"` or `"grp"`.
 * @returns {string} `"done"`, `"refused"` when it answered false, or the code or name of what it threw.
 */
export function change(which) {
	const nodes = { em: () => self.ev.em, inst: () => self.ev.inst, leaf: () => self.leaf.only, grp: () => self.grp };
	try {
		return Reflect.setPrototypeOf(nodes[which](), { theirs: true }) ? "done" : "refused";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}
