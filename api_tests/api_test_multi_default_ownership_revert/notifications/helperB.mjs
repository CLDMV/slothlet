/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multi_default_ownership_revert/notifications/helperB.mjs
 *	@Date: 2026-09-14T15:15:27-07:00 (1789424127)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:27:54-07:00 (1791091674)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture for #366/#372 ownership-revert coverage: second no-default file in the
 * `notifications` multi-default folder — see helperA.mjs's own doc comment. Its `shared`
 * export names the SAME hoisted key as helperA.mjs's, so within this one build one of the
 * two always collides with the other's already-registered ownership entry.
 */

export const shared = "helperB-value";
