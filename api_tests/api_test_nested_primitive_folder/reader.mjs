/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_primitive_folder/reader.mjs
 *	@Date: 2026-11-15T10:25:19-08:00 (1794767119)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:40:37-08:00 (1794775237)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Read a member through `self` by its dotted path.
 * @param {string} path - The member's path, such as "zz.num".
 * @returns {Promise<{kind: string, value: *}|{threw: string}>} What the read and its await gave.
 */
export async function read(path) {
	try {
		let node = self;
		for (const key of path.split(".")) node = node[key];
		await node;
		node = self;
		for (const key of path.split(".")) node = node[key];
		return { kind: typeof node, value: typeof node === "symbol" ? node.description : typeof node === "bigint" ? `${node}n` : node };
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}
