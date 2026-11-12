/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_fast_no_provenance/author/author.mjs
 *	@Date: 2026-11-11T22:31:06-08:00 (1794465066)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:55:58-08:00 (1794477358)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

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
