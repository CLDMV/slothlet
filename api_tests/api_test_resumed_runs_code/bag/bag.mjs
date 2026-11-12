/**
 * @fileoverview A module that hands out a function which reads the vault.
 * @module api_test_resumed_runs_code.bag
 * @memberof module:api_test_resumed_runs_code
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * A function of this module's that reads the vault.
 * @function make
 * @memberof module:api_test_resumed_runs_code.bag
 * @returns {function(): string} The function.
 * @example
 * const fn = await api.bag.make();
 */
export const make = () => () => self.vault.get();
