/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/subfolder/product.mjs
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
 * Creates a new product (default export).
 * Should be accessible as api.subfolder.product() with multi-default detection.
 * @function createProduct
 * @public
 * @param {string} name - Product name
 * @param {number} price - Product price
 * @returns {object} Product object
 */
function createProduct(name, price) {
	return { id: Math.random(), name, price, created: new Date() };
}

/**
 * Calculates product tax (named export).
 * Should be accessible as api.subfolder.product.calculateTax().
 * @function calculateTax
 * @public
 * @param {object} product - Product object
 * @param {number} rate - Tax rate (0.1 for 10%)
 * @returns {number} Tax amount
 */
export function calculateTax(product, rate) {
	return product.price * rate;
}

/**
 * Formats product for display (named export).
 * Should be accessible as api.subfolder.product.formatProduct().
 * @function formatProduct
 * @public
 * @param {object} product - Product object
 * @returns {string} Formatted product string
 */
export function formatProduct(product) {
	return `${product.name} - $${product.price}`;
}

export default createProduct;

