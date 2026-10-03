/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typegen_mixed/settings.mjs
 *	@Date: 2026-09-28 00:01:45 -07:00 (1790578905)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 00:49:33 -07:00 (1790581773)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Non-function exports: a frozen constant object and a primitive (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.settings
 */

/**
 * Retry limits.
 * @type {Readonly<{ maxRetries: number, mode: "strict" | "lenient" }>}
 */
export const LIMITS = Object.freeze({ maxRetries: 3, mode: "strict" });

/**
 * Settings schema version.
 * @type {string}
 */
export const VERSION = "1.2.0";
