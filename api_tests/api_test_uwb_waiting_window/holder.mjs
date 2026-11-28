/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_waiting_window/holder.mjs
 *	@Date: 2026-11-25T01:22:09-08:00 (1795598529)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:04-08:00 (1795869004)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands out what it reads of the folder through `self`.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the folder's `info` member through `self` and hand it back.
 * @returns {object} What `self.tool.info` gave.
 */
export function keepInfo() {
	return self.tool.info;
}
