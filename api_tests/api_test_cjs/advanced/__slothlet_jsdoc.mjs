/**
 * @fileoverview Advanced CJS test modules for complex live-binding scenarios.
 * @summary This module provides advanced test objects and functions for validating complex slothlet live-binding functionality with CommonJS modules. It includes self-referencing objects and cross-module binding tests.
 * @module api_test_cjs.advanced
 * @memberof module:api_test_cjs
 * @package
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 * 	({ slothlet } = await import("@cldmv/slothlet"));
 * 	const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * 	console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
 */

// This file exists solely for JSDoc documentation purposes.
// The dot prefix prevents slothlet from loading it as part of the API.
