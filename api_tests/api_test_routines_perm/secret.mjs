/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_perm/secret.mjs
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
