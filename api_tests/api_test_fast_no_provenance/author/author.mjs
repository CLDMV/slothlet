/**
 * @fileoverview A module the rules deny the vault, which hands out code that reads it: a function returned
 * directly, and one nested in returned data.
 * @module api_test_fast_no_provenance.author
 * @memberof module:api_test_fast_no_provenance
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * A function that reads the vault, returned directly.
 * @function make
 * @memberof module:api_test_fast_no_provenance.author
 * @returns {function(): string} The function.
 * @example
 * const fn = await api.author.make();
 */
export const make = () => () => self.vault.get();

/**
 * Data holding a function that reads the vault.
 * @function box
 * @memberof module:api_test_fast_no_provenance.author
 * @returns {{run: function(): string}} The data.
 * @example
 * const box = await api.author.box();
 */
export const box = () => ({ run: () => self.vault.get() });

/**
 * Read the vault from this module's own leaf.
 * @function own
 * @memberof module:api_test_fast_no_provenance.author
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 * @example
 * await api.author.own(); // "PERMISSION_DENIED"
 */
export async function own() {
	try {
		return await self.vault.get();
	} catch (error) {
		return error.code ?? error.name;
	}
}
