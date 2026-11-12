/**
 * @fileoverview Two exports whose functions have the same text: only the place each is declared at tells them apart.
 * @module api_test_leaf_positions.dup
 * @memberof module:api_test_leaf_positions
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Hands out a function that reads the vault.
 * @function shown
 * @memberof module:api_test_leaf_positions.dup
 * @returns {function(): string} The function.
 * @example
 * (await api.dup.shown())(); // "SECRET"
 */
export const shown = () => () => self.vault.get();

/**
 * Hands out a function that reads the vault, written with the same text as `shown`.
 * @function hidden
 * @memberof module:api_test_leaf_positions.dup
 * @returns {function(): string} The function.
 * @example
 * (await api.dup.hidden())(); // "PERMISSION_DENIED" when the rules deny `dup.hidden`
 */
export const hidden = () => () => self.vault.get();
