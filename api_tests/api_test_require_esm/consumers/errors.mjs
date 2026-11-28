/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_require_esm/consumers/errors.mjs
 *	@Date: 2026-11-27T21:56:34-08:00 (1795845394)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T22:05:36-08:00 (1795845936)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A package's ESM entry that imports `@cldmv/slothlet/errors` statically, which Node's `require(esm)` has to load (#1034).
 * @module api_test_require_esm.consumers.errors
 */
import * as entry from "@cldmv/slothlet/errors";

/** The names `@cldmv/slothlet/errors` exports. */
export const names = Object.keys(entry);
