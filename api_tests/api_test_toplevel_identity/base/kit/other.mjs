/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_toplevel_identity/base/kit/other.mjs
 *	@Date: 2026-11-11T12:00:00-08:00 (1794427200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T12:00:00-08:00 (1794427200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the permission path of file-level code: a sibling file, so its folder holds more than one.
 * @module api_test_toplevel_identity.base.kit.other
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
