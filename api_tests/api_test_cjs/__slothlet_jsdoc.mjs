/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_cjs/__slothlet_jsdoc.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:12 -08:00 (1772425272)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CJS test modules for slothlet API testing.
 * @summary This module provides test objects and functions for validating slothlet's API loading capabilities with CJS modules. It includes math operations, string utilities, advanced nested structures, explicit default exports, and root-level function/object patterns for comprehensive CJS API testing.
 * @module api_test_cjs
 * @name api_test_cjs
 * @alias @cldmv/slothlet/api_tests/api_test_cjs
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 */
// This file exists solely for JSDoc documentation purposes.
// The double-underscore prefix prevents slothlet from loading it as part of the API.
