/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_parity/fnroot/sub/capture.mjs
 *	@Date: 2026-11-15T17:13:23-08:00 (1794791603)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T18:54:23-08:00 (1794797663)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { shape } from "../../shape.mjs";

/** `self` as this file's top-level code took it, while the api was still being built. */
const captured = self;

/**
 * Report what the `self` this file took at its load answers.
 * @returns {Record<string, *>} What each operation gave.
 */
export function report() {
	return shape(captured);
}
