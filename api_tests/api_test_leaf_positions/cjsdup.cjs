/**
 * @fileoverview A CommonJS file assigning two functions with the same text to `exports`.
 * @module api_test_leaf_positions.cjsdup
 * @memberof module:api_test_leaf_positions
 */
// The runtime is an ES module: a CommonJS file reaches it through import().
let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

/**
 * Hands out a function that reads the vault.
 * @returns {function(): string} The function.
 */
exports.shown = () => () => self.vault.get();

/**
 * Hands out a function that reads the vault, written with the same text as `shown`.
 * @returns {function(): string} The function.
 */
exports.hidden = () => () => self.vault.get();
