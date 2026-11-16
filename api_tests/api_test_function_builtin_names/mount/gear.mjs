/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_builtin_names/mount/gear.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file added at a mount by the host: `<mount>.gear.spin`.
 * @module api_test_function_builtin_names.mount.gear
 */

/**
 * Spin.
 * @param {*} x - First.
 * @param {*} y - Second.
 * @returns {string} The two joined.
 * @example
 * api.mnt.gear.spin(1, 2); // "1~2"
 */
export function spin(x, y) {
	return `${x}~${y}`;
}

/**
 * A second function, so the file keeps its own namespace.
 * @returns {string} `"stop"`.
 */
export function stop() {
	return "stop";
}
