/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/shared-lib/helper.mjs
 *	@Date: 2026-11-08T16:00:00-08:00 (1794182400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:00:00-08:00 (1794182400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper in a package of its own that no module's api folder holds (#715), linked into the fixture's
 * `node_modules` from outside it, as a pnpm workspace links a package. Module `a` imports it by path, module `b` by its
 * package name. Each evaluation records the URL it ran under and the identity object it created, so the fixture can tell
 * one module record from two.
 * @module api_test_shared_helper_import_split.shared-lib.helper
 */
const evaluations = (globalThis.__sharedHelperImportSplit ??= { urls: [], identities: [] });

/** This evaluation's identity: the same object through every import of one module record. */
export const identity = {};
evaluations.urls.push(import.meta.url);
evaluations.identities.push(identity);

/**
 * Call the target's `whoami` through the `self` it is handed.
 * @param {object} self - The calling leaf's `self`.
 * @returns {Promise<string|null>} Who the target saw as its caller.
 */
export async function readTarget(self) {
	return self.target.whoami();
}
