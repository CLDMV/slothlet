/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_positions/renamed.mjs
 *	@Date: 2026-11-11T22:55:16-08:00 (1794466516)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:55-08:00 (1794477415)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

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
