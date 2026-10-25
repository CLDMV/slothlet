/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_array_read/store.mjs
 *	@Date: 2026-10-24T14:33:07-07:00 (1792877587)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T14:56:21-07:00 (1792878981)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module holding frozen arrays of objects, exported directly and nested in an object (#655).
 */

/**
 * A frozen array of objects.
 * @type {ReadonlyArray<object>}
 */
export const list = Object.freeze([{ a: 1 }, { b: 2 }]);

/**
 * An object holding a frozen array of objects.
 * @type {{list: ReadonlyArray<object>}}
 */
export const data = { list: Object.freeze([{ a: 1 }, { b: 2 }]) };
