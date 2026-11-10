/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/b/b.mjs
 *	@Date: 2026-11-08T15:50:17-08:00 (1794181817)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:00:38-08:00 (1794182438)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module `b` (#715): imports the shared helper by its package name.
 * @module api_test_shared_helper_import_split.b
 */
import { self } from "@cldmv/slothlet/runtime";
import { identity, readTarget } from "shared-lib";

/**
 * Which evaluation of the helper the package-name import reached.
 * @returns {number} Its index among the helper's evaluations.
 */
export function idByName() {
	return globalThis.__sharedHelperImportSplit.identities.indexOf(identity);
}

/**
 * Who the target sees calling through the helper imported by name.
 * @returns {Promise<string|null>} The caller's api path.
 */
export async function viaName() {
	return readTarget(self);
}
