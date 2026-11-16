/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_parity/siblingroot/capture.mjs
 *	@Date: 2026-11-15T17:03:37-08:00 (1794791017)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T18:54:22-08:00 (1794797662)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { shape } from "../shape.mjs";

/** `self` as this file's top-level code took it, beside the root file, while the api was being built. */
const captured = self;

/**
 * Report what the `self` this file took at its load answers.
 * @returns {Record<string, *>} What each operation gave.
 */
export function report() {
	return shape(captured);
}
