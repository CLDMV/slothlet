/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/subfolder/order.mjs
 *	@Date: 2025-10-23 12:30:34 -07:00 (1761247834)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-23 12:30:59 -07:00 (1761247859)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Order management functions for subfolder testing.
 * Subfolder default export should work correctly with multi-default detection.
 * Expected: subfolder.order() creates order, subfolder.order.calculateTotal(), etc.
 */

/**
 * Creates a new order (default export).
 * Should be accessible as api.subfolder.order() with multi-default detection.
 * @function createOrder
 * @public
 * @param {string} userId - User ID
 * @param {string[]} products - Array of product IDs
 * @returns {object} Order object
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
 */
export function updateStatus(order, status) {
	return { ...order, status, updated: new Date() };
}

export default createOrder;
