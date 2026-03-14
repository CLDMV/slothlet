/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/subfolder/order.mjs
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
 * @fileoverview Order API module for api_test_root_issue subfolder testing.
 * @module api_test_root_issue.subfolder.order
 * @memberof module:api_test_root_issue
 */
/**
 * @namespace order
 * @memberof module:api_test_root_issue.subfolder
 * @alias module:api_test_root_issue.subfolder.order
 */

/**
 * Creates a new order (default export).
 * Should be accessible as api.subfolder.order() with multi-default detection.
 * @function createOrder
 * @public
 * @param {string} userId - User ID
 * @param {string[]} products - Array of product IDs
 * @returns {object} Order object
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.subfolder.order.createOrder('item1', []);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.subfolder.order.createOrder('item1', []);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.subfolder.order.createOrder('item1', []);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.subfolder.order.createOrder('item1', []);
 */
function createOrder(userId, products) {
	return { id: Math.random(), userId, products, created: new Date(), status: "pending" };
}

/**
 * Calculates order total (named export).
 * Should be accessible as api.subfolder.order.calculateTotal().
 * @function calculateTotal
 * @public
 * @param {object} order - Order object
 * @param {object[]} products - Array of product objects
 * @returns {number} Total order amount
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.subfolder.order.calculateTotal({}, []);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.subfolder.order.calculateTotal({}, []);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.subfolder.order.calculateTotal({}, []);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.subfolder.order.calculateTotal({}, []);
 */
export function calculateTotal(order, products) {
	return products.reduce((total, product) => total + product.price, 0);
}

/**
 * Updates order status (named export).
 * Should be accessible as api.subfolder.order.updateStatus().
 * @function updateStatus
 * @public
 * @param {object} order - Order object
 * @param {string} status - New status
 * @returns {object} Updated order object
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.subfolder.order.updateStatus({}, 'value');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.subfolder.order.updateStatus({}, 'value');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 *   api_test_root_issue.subfolder.order.updateStatus({}, 'value');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_root_issue = await slothlet({ dir: './api_tests/api_test_root_issue' });
 * api_test_root_issue.subfolder.order.updateStatus({}, 'value');
 */
export function updateStatus(order, status) {
	return { ...order, status, updated: new Date() };
}

export default createOrder;

