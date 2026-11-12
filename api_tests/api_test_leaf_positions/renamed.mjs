/**
 * @fileoverview Two functions with the same text, exported under other names by a list.
 * @module api_test_leaf_positions.renamed
 * @memberof module:api_test_leaf_positions
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Exported as `shown`.
 * @returns {function(): string} A function that reads the vault.
 */
const inner = () => () => self.vault.get();

/**
 * Exported as `hidden`.
 * @returns {function(): string} A function that reads the vault.
 */
const other = () => () => self.vault.get();

export { inner as shown, other as hidden };
