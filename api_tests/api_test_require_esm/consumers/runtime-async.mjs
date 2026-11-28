/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_require_esm/consumers/runtime-async.mjs
 *	@Date: 2026-11-27T21:56:34-08:00 (1795845394)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:24-08:00 (1795868964)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A package's ESM entry that imports `@cldmv/slothlet/runtime/async` statically, which Node's `require(esm)` has to load (#1034).
 * @module api_test_require_esm.consumers.runtime-async
 */
import * as entry from "@cldmv/slothlet/runtime/async";

/** The names `@cldmv/slothlet/runtime/async` exports. */
export const names = Object.keys(entry);
