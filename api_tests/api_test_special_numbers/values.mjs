/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_special_numbers/values.mjs
 *	@Date: 2026-10-11T20:53:38-07:00 (1791777218)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:03:20-07:00 (1791781400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): numbers JSON cannot tell apart from `null` or `0`, so the
 * structure check's api shape must encode them.
 * @module api_test_special_numbers.values
 */

export const notANumber = NaN;
export const infinity = Infinity;
export const negativeInfinity = -Infinity;
export const negativeZero = -0;
export const zero = 0;
export const nothing = null;
