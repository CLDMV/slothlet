/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/a/a.mjs
 *	@Date: 2026-11-08T15:51:28-08:00 (1794181888)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:00:37-08:00 (1794182437)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module `a` (#715): imports the shared helper by a relative path into its package, and by a `file:` URL.
 * @module api_test_shared_helper_import_split.a
 */
import { self } from "@cldmv/slothlet/runtime";
import { identity, readTarget } from "../shared-lib/helper.mjs";

/** The helper reached by a `file:` URL, imported on first use. */
const byURL = () => import(new URL("../shared-lib/helper.mjs", import.meta.url).href);

/**
 * Which evaluation of the helper the relative import reached.
 * @returns {number} Its index among the helper's evaluations.
 */
export function idByPath() {
	return globalThis.__sharedHelperImportSplit.identities.indexOf(identity);
}

/**
 * Which evaluation of the helper the `file:` URL import reached.
 * @returns {Promise<number>} Its index among the helper's evaluations.
 */
export async function idByURL() {
	return globalThis.__sharedHelperImportSplit.identities.indexOf((await byURL()).identity);
}

/**
 * Who the target sees calling through the helper imported by path.
 * @returns {Promise<string|null>} The caller's api path.
 */
export async function viaPath() {
	return readTarget(self);
}

/**
 * Who the target sees calling through the helper imported by `file:` URL.
 * @returns {Promise<string|null>} The caller's api path.
 */
export async function viaURL() {
	return (await byURL()).readTarget(self);
}
