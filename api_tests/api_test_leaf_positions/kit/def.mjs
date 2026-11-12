/**
 * @fileoverview A default export and a named export whose functions have the same text.
 * @module api_test_leaf_positions.kit.def
 * @memberof module:api_test_leaf_positions
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The default export: hands out a function that reads the vault.
 * @returns {function(): string} The function.
 * @example
 * (await api.kit.def())(); // "SECRET"
 */
export default () => () => self.vault.get();

/**
 * Hands out a function that reads the vault, written with the same text as the default export.
 * @function hidden
 * @memberof module:api_test_leaf_positions.kit.def
 * @returns {function(): string} The function.
 * @example
 * (await api.kit.def.hidden())(); // "PERMISSION_DENIED" when the rules deny `def.hidden`
 */
export const hidden = () => () => self.vault.get();
