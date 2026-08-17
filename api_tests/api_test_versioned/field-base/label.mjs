/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_versioned/field-base/label.mjs
 *	@Date: 2026-08-17 00:00:00 -07:00 (1786953600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-17 00:00:00 -07:00 (1786953600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Base field fixture (#283): a public terminal export that collides with a version-dispatched field,
 * so a test can read a NON-marker terminal off the branded wrapper (the exemption stays key-scoped).
 */

/**
 * A public terminal value that survives the dispatcher collision merge.
 * @type {string}
 */
export const label = "base-field";
