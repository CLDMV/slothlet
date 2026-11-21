/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_copies/helpers/private.mjs
 *	@Date: 2026-11-12T00:34:26-08:00 (1794472466)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T00:34:26-08:00 (1794472466)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file only `two.mjs` loads, with a dynamic import whose URL names another api file.
 * @module api_test_helper_copies.helpers.private
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault. The helper's own function: no leaf's code is written in it.
 * @returns {string} What the vault holds.
 * @example
 * read(); // "SECRET"
 */
export const read = () => self.vault.get();
