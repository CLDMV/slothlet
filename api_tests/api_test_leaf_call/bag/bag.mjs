/**
 * @fileoverview A service module: one exported function that reads the vault, and the ways a module can hand that
 * function, or a private one, to another module.
 * @module api_test_leaf_call.bag
 * @memberof module:api_test_leaf_call
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The service's own function: reads the vault.
 * @function viaLeaf
 * @memberof module:api_test_leaf_call.bag
 * @returns {string} What the vault answered.
 * @example
 * api.bag.viaLeaf(); // "SECRET"
 */
export const viaLeaf = () => self.vault.get();

/**
 * Hands out the api node of `viaLeaf`.
 * @function leafRef
 * @memberof module:api_test_leaf_call.bag
 * @returns {Function} The node.
 * @example
 * (await api.bag.leafRef())(); // "SECRET"
 */
export const leafRef = () => self.bag.viaLeaf;

/**
 * Hands out the exported function `viaLeaf` itself.
 * @function boundLeaf
 * @memberof module:api_test_leaf_call.bag
 * @returns {Function} The function.
 * @example
 * (await api.bag.boundLeaf())(); // "SECRET"
 */
export const boundLeaf = () => viaLeaf;

/**
 * Hands out the exported function `viaLeaf` inside plain data.
 * @function inData
 * @memberof module:api_test_leaf_call.bag
 * @returns {{run: Function}} The data.
 * @example
 * (await api.bag.inData()).run(); // "SECRET"
 */
export const inData = () => ({ run: viaLeaf });

/**
 * Hands out a private function, written here and exported by no one, that reads the vault.
 * @function closure
 * @memberof module:api_test_leaf_call.bag
 * @returns {function(): string} The function.
 * @example
 * (await api.bag.closure())(); // "SECRET" for the host
 */
export const closure = () => () => self.vault.get();
