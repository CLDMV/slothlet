/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inherited_members/shadowdir/valueOf.mjs
 *	@Date: 2026-11-04T21:15:39-08:00 (1793855739)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:25:42-08:00 (1793859942)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file named like an `Object.prototype` member (#630), composed as `api.shadowdir.valueOf`.
 * @module api_test_inherited_members/shadowdir/valueOf
 */

/** @returns {string} Marker. */
export default function valueOf() {
	return "file valueOf";
}
