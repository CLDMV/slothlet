/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/callee/ops.mjs
 *	@Date: 2026-10-17T21:07:21-07:00 (1792296441)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T23:01:54-07:00 (1792303314)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "callee" (moduleID "callee") by the nested self-assign ownership tests (#625).
// `useSecret` is the member another module tries to replace; `writeOwnNested` writes under the
// module's own subtree, which stays allowed.
import { self } from "@cldmv/slothlet/runtime";

/**
 * The member a foreign module tries to replace.
 * @returns {string} The callee's own answer.
 */
export function useSecret() {
	return "callee-original";
}

/**
 * Write a value under this module's own mount point, below the top level.
 * @param {*} value - Value to write.
 * @returns {*} The value read back through `self`.
 */
export function writeOwnNested(value) {
	self.callee.ops.note = value;
	return self.callee.ops.note;
}

/**
 * An array member: another module setting its prototype would reach the module's own array.
 * @type {string[]}
 */
export const list = ["a", "b"];
