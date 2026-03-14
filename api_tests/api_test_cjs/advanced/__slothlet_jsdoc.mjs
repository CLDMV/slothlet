/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_cjs/advanced/__slothlet_jsdoc.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-10 17:57:47 -07:00 (1773190667)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Advanced CJS test submodule for slothlet API testing.
 * @summary Provides advanced nested CJS module patterns, including self-reference via the runtime `self` binding for cross-module calls within the same slothlet instance.
 * @module api_test_cjs.advanced
 * @name api_test_cjs.advanced
 * @memberof module:api_test_cjs
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.advanced.selfObject.getSelf());
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.advanced.selfObject.getSelf());
 */
// This file exists solely for JSDoc documentation purposes.
// The double-underscore prefix prevents slothlet from loading it as part of the API.
