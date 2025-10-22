/**
 * @fileoverview CommonJS test modules for slothlet CJS interoperability.
 * @summary This module provides test objects and functions for validating slothlet's ability to load and manage CommonJS (.cjs) modules. It includes math operations, string utilities, and advanced nested structures for comprehensive CJS API testing.
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
 * 	({ slothlet } = await import("@cldmv/slothlet"));
 * 	const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 */

// This file exists solely for JSDoc documentation purposes.
// The dot prefix prevents slothlet from loading it as part of the API.
