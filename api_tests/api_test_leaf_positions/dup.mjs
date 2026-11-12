/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_positions/dup.mjs
 *	@Date: 2026-11-11T22:55:16-08:00 (1794466516)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:54-08:00 (1794477414)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

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
