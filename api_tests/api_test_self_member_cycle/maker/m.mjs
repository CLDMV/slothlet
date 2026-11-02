/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_member_cycle/maker/m.mjs
 *	@Date: 2026-11-01T17:10:25-08:00 (1793581825)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T18:26:39-08:00 (1793586399)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Mounts a value holding a cyclic member and hands it back as read through `self` (#688).
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Mount `{ host, conn }` at `things.x`, with `conn.self` and `conn.loop.back` pointing back at `conn` and one
 * object held at both `conn.open` and `conn.shut`, and return it through `self`.
 * @returns {Promise<object>} `self.things.x`.
 * @example
 * await make(); // self.things.x
 */
export async function make() {
	const leaf = { host: "h", conn: { id: 1 } };
	leaf.conn.self = leaf.conn;
	// A cycle two steps long.
	leaf.conn.loop = { back: leaf.conn };
	// One object at two paths under the node, which write rules can tell apart.
	const shared = { kind: "shared" };
	leaf.conn.open = shared;
	leaf.conn.shut = shared;
	await self.slothlet.api.add("things.x", leaf, { moduleID: "thing:x" });
	return self.things.x;
}
