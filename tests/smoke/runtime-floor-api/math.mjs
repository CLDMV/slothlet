/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/smoke/runtime-floor-api/math.mjs
 *	@Date: 2026-11-17T00:00:00-08:00 (1794902400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T00:00:00-08:00 (1794902400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Math leaf for the runtime-floor smoke check. Reached as `api.math.add`.
 * @module api_runtime_floor.math
 * @internal
 */

/**
 * Adds two numbers.
 * @param {number} a - First addend.
 * @param {number} b - Second addend.
 * @returns {number} The sum.
 */
export function add(a, b) {
	return a + b;
}
