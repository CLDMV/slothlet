/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_flow/api/early.mjs
 *	@Date: 2026-11-12T22:53:16-08:00 (1794552796)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:53:16-08:00 (1794552796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file, loaded before `late.mjs`, that starts loading `helpers/slow.mjs` without waiting for it.
 * @module api_test_load_flow.early
 */
import("../helpers/slow.mjs");

/**
 * Answer a ping.
 * @returns {string} "pong".
 * @example
 * api.early.ping(); // "pong"
 */
export const ping = () => "pong";
