/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/virtual.mjs
 *	@Date: 2026-10-13T01:54:43-07:00 (1791881683)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-13T01:56:32-07:00 (1791881792)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture: an array proxy whose element 0 is supplied by its get trap, not held as a key.
 */

export const virt = new Proxy(new Array(1), {
	get: (target, key, receiver) => (key === "0" ? "SECRET" : Reflect.get(target, key, receiver))
});
