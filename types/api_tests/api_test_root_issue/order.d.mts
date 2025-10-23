/**
 * Calculates order total (named export).
 * Should be accessible as api.calculateTotal().
 * @function calculateTotal
 * @public
 * @param {object} order - Order object
 * @param {object[]} products - Array of product objects
 * @returns {number} Total order amount
 */
export function calculateTotal(order: object, products: object[]): number;
/**
 * Updates order status (named export).
 * Should be accessible as api.updateStatus().
 * @function updateStatus
 * @public
 * @param {object} order - Order object
 * @param {string} status - New status
 * @returns {object} Updated order object
 */
export function updateStatus(order: object, status: string): object;
export default createOrder;
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/order.mjs
 *	@Date: 2025-10-23 12:24:58 -07:00 (1761247498)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-23 12:30:44 -07:00 (1761247844)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Order management functions for root-level API testing.
 * Root-level default export should flatten but currently breaks with multi-default detection.
 * Expected: With multiple root defaults, this should not flatten (conflict resolution)
 * Bug: Multi-default detection applies to root level incorrectly.
 */
/**
 * Creates a new order (default export).
 * With multiple root-level defaults, this creates a conflict that needs proper resolution.
 * @function createOrder
 * @public
 * @param {string} userId - User ID
 * @param {string[]} products - Array of product IDs
 * @returns {object} Order object
 */
declare function createOrder(userId: string, products: string[]): object;
//# sourceMappingURL=order.d.mts.map