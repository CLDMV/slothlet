/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_add_collision/extra/shared.mjs
 *	@Date: 2026-11-18T20:34:46-08:00 (1795062886)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T20:54:38-08:00 (1795064078)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `extra`'s shared leaf; collides with `core`'s on `who`.
 */

/**
 * Name the module.
 * @returns {string} `"extra"`.
 * @example
 * who(); // "extra"
 */
export const who = () => "extra";

/**
 * Only in `extra`'s shared.
 * @returns {string} `"extra-only"`.
 * @example
 * extraOnly(); // "extra-only"
 */
export const extraOnly = () => "extra-only";
