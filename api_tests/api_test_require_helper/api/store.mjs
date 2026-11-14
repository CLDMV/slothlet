/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_require_helper/api/store.mjs
 *	@Date: 2026-11-12T23:03:11-08:00 (1794553391)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:03:11-08:00 (1794553391)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The data the other modules of this fixture read.
 * @module api_test_require_helper.api.store
 */

/**
 * A sealed object with a member some callers are denied.
 * @type {{x: number, hid: string, obj: {k: number}}}
 */
export const sealed = Object.seal({ x: 1, hid: "S3CRET", obj: { k: 1 } });
