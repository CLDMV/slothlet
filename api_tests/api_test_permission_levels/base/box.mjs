/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_permission_levels/base/box.mjs
 *	@Date: 2026-11-18T09:00:00-08:00 (1795021200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:06-08:00 (1795868946)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base module's box: an object holding a plain member and a getter, which runs the module's code
 * when it is read.
 */

export default {
	plain: 2,
	/**
	 * A member answered by running the module's code.
	 * @returns {number} `1`.
	 */
	get computed() {
		return 1;
	}
};
