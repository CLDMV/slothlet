/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/bystander/writer.mjs
 *	@Date: 2026-10-18T21:08:35-07:00 (1792382915)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T21:34:34-07:00 (1792384474)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "bystander" (moduleID "bystander") by the nested self-assign ownership tests (#625): a module a
// grant naming another caller gives nothing.
import * as symbolWrites from "../shared/symbol-writes.mjs";

/**
 * Assign, define, and delete a symbol-keyed member on the node at `apiPath`; see `../shared/symbol-writes.mjs`.
 * @param {string} [apiPath="callee.ops"] - Dotted path of the node.
 * @returns {{assign: string, define: string, remove: string}} Outcome of each change.
 */
export function writeCalleeSymbol(apiPath = "callee.ops") {
	return symbolWrites.writeSymbol(apiPath);
}

/**
 * @returns {string} `"bystander"`.
 */
export function name() {
	return "bystander";
}
