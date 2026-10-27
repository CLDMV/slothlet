/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/callee_peer/peer.mjs
 *	@Date: 2026-10-17T21:11:52-07:00 (1792296712)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T21:21:55-07:00 (1792297315)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "callee" beside the callee module, under its own moduleID, by the nested
// self-assign ownership tests (#625). Both modules have the endpoint "callee", so each may write under it.
import { self } from "@cldmv/slothlet/runtime";

/**
 * Write below the shared mount point, into the other module's node.
 * @param {*} value - Value to write.
 * @returns {*} The value read back through `self`.
 */
export function writeShared(value) {
	self.callee.ops.peerNote = value;
	return self.callee.ops.peerNote;
}
