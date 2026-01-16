/**
 * @fileoverview ESM test modules for slothlet API testing.
 * @summary This module provides test objects and functions for validating slothlet's API loading capabilities with ESM modules. It includes math operations, configuration management, advanced nested structures, and various export patterns for comprehensive API testing.
 * @module api_test
 * @name api_test
 * @alias @cldmv/slothlet/api_tests/api_test
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 * 	({ slothlet } = await import("@cldmv/slothlet"));
 * 	const api_test = await slothlet({ dir: './api_tests/api_test' });
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 */

// This file exists solely for JSDoc documentation purposes.
// The dot prefix prevents slothlet from loading it as part of the API.
