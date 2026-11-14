/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/api/relay.mjs
 *	@Date: 2026-11-11T11:47:43-08:00 (1794426463)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:00-08:00 (1794431580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for relayed code: a module allowed the vault that passes what it is handed on to another.
 * @module api_test_load_identity.relay
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Pass a function on to `runner`.
 * @param {Function} fn - The function.
 * @returns {*} What `runner` returned.
 */
export const pass = (fn) => self.runner.call(fn);

/**
 * A second export, so the file is a module with leaves.
 * @returns {string} A marker.
 */
export const ping = () => "pong";
