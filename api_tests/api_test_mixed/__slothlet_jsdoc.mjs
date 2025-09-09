/**
 * @fileoverview Mixed ESM/CJS test modules for slothlet interoperability.
 * @summary This module provides test objects and functions for validating slothlet's ability to load and manage both ESM (.mjs) and CommonJS (.cjs) modules within the same API structure. It includes math operations, interoperability testing utilities, and live binding validation across different module systems.
 * @module api_test_mixed
 * @name api_test_mixed
 * @alias @cldmv/slothlet/api_tests/api_test_mixed
 * @package
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 * 	({ slothlet } = await import("@cldmv/slothlet"));
 * 	const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 */

// This file exists solely for JSDoc documentation purposes.
// The dot prefix prevents slothlet from loading it as part of the API.
