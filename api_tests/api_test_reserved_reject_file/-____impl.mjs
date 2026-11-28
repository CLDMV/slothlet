/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_reserved_reject_file/-____impl.mjs
 *	@Date: 2026-08-04T12:00:00-07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:27-08:00 (1795868967)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module file named for a framework-reserved key — the scan must refuse it (#260).
 * @module api_test_reserved_reject_file.____impl
 */

/** @type {string} Never composes. */
export const probe = "never";
