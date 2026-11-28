/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_reader_copies/store.mjs
 *	@Date: 2026-11-25T01:19:57-08:00 (1795598397)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:02-08:00 (1795869002)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose exports another module reads through `self`.
 */

/** Plain data members. */
export const data = { count: 1, nested: { deep: true } };

/** An array with an accessor element. */
export const list = (() => {
	const array = [10, 20];
	Object.defineProperty(array, 2, { get: () => ({ third: 3 }), enumerable: true, configurable: true });
	Object.defineProperty(array, 3, { get: () => 40, enumerable: true, configurable: true });
	Object.defineProperty(array, 4, { get: () => undefined, enumerable: true, configurable: true });
	return array;
})();
