/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reserved_nested/shutdown/impl.mjs
 *	@Date: 2026-08-08 22:00:00 -07:00 (1786251600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-08 22:49:59 -07:00 (1786254599)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

// `shutdown` is reserved only at the API ROOT (the injected lifecycle key); nested under a
// mount it is an ordinary namespace (issue #176). Two files keep it a namespace, not a
// solo-hoist leaf, so leaves() must settle INTO it under lazy to register its children.

/**
 * Nested leaf under the reserved-named namespace.
 * @returns {number} Marker.
 */
export function impl() {
	return 2;
}
