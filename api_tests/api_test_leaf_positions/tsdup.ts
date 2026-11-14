/**
 * @fileoverview A TypeScript file: its functions' text is the compiled code's, not this file's.
 * @module api_test_leaf_positions.tsdup
 * @memberof module:api_test_leaf_positions
 */
import { self } from "@cldmv/slothlet/runtime";

type Reader = () => string;

/**
 * Hands out a function that reads the vault.
 * @returns The function.
 */
export const shown = (): Reader => (): string => self.vault.get();

/**
 * Hands out a function that reads the vault, written with the same text as `shown`.
 * @returns The function.
 */
export const hidden = (): Reader => (): string => self.vault.get();
