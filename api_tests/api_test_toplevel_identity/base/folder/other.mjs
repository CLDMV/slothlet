/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_toplevel_identity/base/folder/other.mjs
 *	@Date: 2026-11-11T11:24:50-08:00 (1794425090)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:34-08:00 (1794431614)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the permission path of file-level code: a sibling file, so its folder holds more than one.
 * @module api_test_toplevel_identity.base.folder.other
 */

/**
 * A marker.
 * @returns {string} The marker.
 */
export function marker() {
	return "other";
}

/**
 * A second marker.
 * @returns {string} The marker.
 */
export function second() {
	return "second";
}
