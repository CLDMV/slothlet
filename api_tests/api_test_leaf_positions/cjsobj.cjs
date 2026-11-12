/**
 * @fileoverview A CommonJS file exporting two locals with the same text through an object literal.
 * @module api_test_leaf_positions.cjsobj
 * @memberof module:api_test_leaf_positions
 */
// The runtime is an ES module: a CommonJS file reaches it through import().
let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

/**
 * Exported as `shown`.
 * @returns {function(): string} A function that reads the vault.
 */
const first = () => () => self.vault.get();

/**
 * Exported as `hidden`.
 * @returns {function(): string} A function that reads the vault.
 */
const second = () => () => self.vault.get();

module.exports = { shown: first, hidden: second };
