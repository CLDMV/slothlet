/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_positions/kit/def.mjs
 *	@Date: 2026-11-11T22:56:01-08:00 (1794466561)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:06:19-08:00 (1794675979)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

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
 * (await api.kit())(); // "SECRET"
 */
export default () => () => self.vault.get();

/**
 * Hands out a function that reads the vault, written with the same text as the default export.
 * @function hidden
 * @memberof module:api_test_leaf_positions.kit.def
 * @returns {function(): string} The function.
 * @example
 * (await api.kit.hidden())(); // "PERMISSION_DENIED" when the rules deny `kit.hidden`
 */
export const hidden = () => () => self.vault.get();
