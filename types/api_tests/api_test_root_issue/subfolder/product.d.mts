/**
 * Calculates product tax (named export).
 * Should be accessible as api.subfolder.product.calculateTax().
 * @function calculateTax
 * @public
 * @param {object} product - Product object
 * @param {number} rate - Tax rate (0.1 for 10%)
 * @returns {number} Tax amount
 */
export function calculateTax(product: object, rate: number): number;
/**
 * Formats product for display (named export).
 * Should be accessible as api.subfolder.product.formatProduct().
 * @function formatProduct
 * @public
 * @param {object} product - Product object
 * @returns {string} Formatted product string
 */
export function formatProduct(product: object): string;
export default createProduct;
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/subfolder/product.mjs
 *	@Date: 2025-10-23 12:30:22 -07:00 (1761247822)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-23 12:30:53 -07:00 (1761247853)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Product management functions for subfolder testing.
 * Subfolder default export should work correctly with multi-default detection.
 * Expected: subfolder.product() creates product, subfolder.product.calculateTax(), etc.
 */
/**
 * Creates a new product (default export).
 * Should be accessible as api.subfolder.product() with multi-default detection.
 * @function createProduct
 * @public
 * @param {string} name - Product name
 * @param {number} price - Product price
 * @returns {object} Product object
 */
declare function createProduct(name: string, price: number): object;
//# sourceMappingURL=product.d.mts.map