/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/product.mjs
 *	@Date: 2025-10-23T13:13:39-07:00 (1761250419)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:16 -08:00 (1772425276)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Product API module for api_test_root_issue testing.
 * @module api_test_root_issue.product
 * @memberof module:api_test_root_issue
 */
/**
 * @namespace product
 * @memberof module:api_test_root_issue
 * @alias module:api_test_root_issue.product
 */

/**
 * Creates a new product (default export).
 * Should cause conflicts with multi-default detection when multiple root defaults exist.
 * @function createProduct
 * @public
 * @param {string} name - Product name
 * @param {number} price - Product price
 * @returns {object} Product object
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.product.createProduct('myName', 1);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.product.createProduct('myName', 1);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.product.createProduct('myName', 1);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.product.createProduct('myName', 1);
 */
function createProduct(name, price) {
	return { id: Math.random(), name, price, created: new Date() };
}

/**
 * Calculates product tax (named export).
 * Should be accessible as api.calculateTax().
 * @function calculateTax
 * @public
 * @param {object} product - Product object
 * @param {number} rate - Tax rate (0.1 for 10%)
 * @returns {number} Tax amount
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.product.calculateTax({}, 1);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.product.calculateTax({}, 1);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.product.calculateTax({}, 1);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.product.calculateTax({}, 1);
 */
export function calculateTax(product, rate) {
	return product.price * rate;
}

/**
 * Formats product for display (named export).
 * Should be accessible as api.formatProduct().
 * @function formatProduct
 * @public
 * @param {object} product - Product object
 * @returns {string} Formatted product string
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.product.formatProduct({});
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.product.formatProduct({});
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.product.formatProduct({});
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.product.formatProduct({});
 */
export function formatProduct(product) {
	return `${product.name} - $${product.price}`;
}

export default createProduct;

