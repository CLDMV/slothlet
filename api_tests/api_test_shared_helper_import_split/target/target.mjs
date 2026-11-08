/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/target/target.mjs
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
 * @fileoverview The target the shared helper calls (#715): reports who called it.
 * @module api_test_shared_helper_import_split.target
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The api path of the leaf calling.
 * @returns {string|null} The caller's api path, or null when none is known.
 */
export function whoami() {
	return self.slothlet.metadata.caller()?.apiPath ?? null;
}
