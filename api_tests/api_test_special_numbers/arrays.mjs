/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_special_numbers/arrays.mjs
 *	@Date: 2026-10-12T03:09:00-07:00 (1791799740)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T03:41:38-07:00 (1791801698)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): two arrays with the same enumerable elements and different lengths.
 * @module api_test_special_numbers.arrays
 */

// A trailing hole adds to `length` but not to the enumerable indices.
export const holey = [1];
holey.length = 2;

export const short = [1];
