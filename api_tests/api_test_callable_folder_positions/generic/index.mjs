/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_callable_folder_positions/generic/index.mjs
 *	@Date: 2026-11-14T14:30:00-08:00 (1794695400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T14:30:00-08:00 (1794695400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder's only file: a default export and a named export whose functions have the same text.
 * @module api_test_callable_folder_positions.generic
 * @memberof module:api_test_callable_folder_positions
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The default export, which the folder is: hands out a function that reads the vault.
 * @returns {function(): string} The function.
 * @example
 * (await api.generic())(); // "SECRET"
 */
export default () => () => self.vault.get();

/**
 * Hands out a function that reads the vault, written with the same text as the default export.
 * @function hidden
 * @memberof module:api_test_callable_folder_positions.generic
 * @returns {function(): string} The function.
 * @example
 * (await api.generic.hidden())(); // "PERMISSION_DENIED" when the rules deny `generic.hidden`
 */
export const hidden = () => () => self.vault.get();
