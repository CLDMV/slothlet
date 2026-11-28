/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_private_subdir/pkg/tool.mjs
 *	@Date: 2026-08-08T21:30:00-07:00 (1786249800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:15-08:00 (1795868955)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Public sibling so the directory is a normal mount with a private subdirectory beside it.

/**
 * Public callable.
 * @returns {number} Marker.
 */
export function run() {
	return 1;
}
