/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_mixed/__slothlet_jsdoc.mjs
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
 * @fileoverview Mixed ESM+CJS test modules for slothlet API testing.
 * @summary This module provides test objects and functions for validating slothlet's API loading capabilities with mixed ESM and CJS modules. It includes both ESM and CJS math operations and cross-module interoperability tests using slothlet's runtime self-reference feature.
 * @module api_test_mixed
 * @name api_test_mixed
 * @alias @cldmv/slothlet/api_tests/api_test_mixed
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 */
// This file exists solely for JSDoc documentation purposes.
// The double-underscore prefix prevents slothlet from loading it as part of the API.
