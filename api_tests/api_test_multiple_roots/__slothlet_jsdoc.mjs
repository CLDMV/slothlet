/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multiple_roots/__slothlet_jsdoc.mjs
 *	@Date: 2026-03-11 02:00:00 -07:00 (1773219600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 21:33:12 -07:00 (1773376392)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Multiple-root conflict modules for slothlet collision and overwrite testing.
 * @summary This module provides test objects and functions for validating slothlet's API loading capabilities. It includes the full api_test_multiple_roots API surface documented for reference.
 * @module api_test_multiple_roots
 * @name api_test_multiple_roots
 * @alias @cldmv/slothlet/api_tests/api_test_multiple_roots
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 */
// This file exists solely for JSDoc documentation purposes.
// The __ prefix prevents slothlet from loading it as part of the API.
