/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_callable_folder_positions/plain.mjs
 *	@Date: 2026-11-14T14:30:00-08:00 (1794695400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:35-08:00 (1795868855)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file of two exports with the same text, read after the callable folders.
 * @module api_test_callable_folder_positions.plain
 * @memberof module:api_test_callable_folder_positions
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Hands out a function that reads the vault.
 * @function shown
 * @memberof module:api_test_callable_folder_positions.plain
 * @returns {function(): string} The function.
 * @example
 * (await api.plain.shown())(); // "SECRET"
 */
export const shown = () => () => self.vault.get();

/**
 * Hands out a function that reads the vault, written with the same text as `shown`.
 * @function hidden
 * @memberof module:api_test_callable_folder_positions.plain
 * @returns {function(): string} The function.
 * @example
 * (await api.plain.hidden())(); // "PERMISSION_DENIED" when the rules deny `plain.hidden`
 */
export const hidden = () => () => self.vault.get();
