/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/control-caller.mjs
 *	@Date: 2026-04-21 06:45:00 -07:00 (1776736700)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-21 06:45:00 -07:00 (1776736700)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Attempt to enable the permission system via inter-module call.
 * Used in tests verifying that control.** is protected even when permissions are disabled.
 *
 * @returns {void}
 * @example
 * api.callers.controlCaller.callEnable();
 */
export const callEnable = () => self.slothlet.permissions.control.enable();

/**
 * Attempt to disable the permission system via inter-module call.
 * Used in tests verifying that control.** is protected even when permissions are disabled.
 *
 * @returns {void}
 * @example
 * api.callers.controlCaller.callDisable();
 */
export const callDisable = () => self.slothlet.permissions.control.disable();
