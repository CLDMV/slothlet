/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_perm/secret.mjs
 *	@Date: 2026-09-15T21:35:50-07:00 (1789533350)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-26 22:31:19 -07:00 (1790487079)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The permission-gated target both routine contributors reach through ambient
 * `self.secret.read()`. Because A and B call the IDENTICAL target, the only way one can be allowed
 * and the other denied is if each runs under its OWN caller identity (#393).
 * @module api_test_routines_perm.secret
 * @memberof module:api_test_routines_perm
 */

/**
 * @function read
 * @memberof module:api_test_routines_perm
 * @returns {string} `"secret-value"`.
 */
export function read() {
	return "secret-value";
}
