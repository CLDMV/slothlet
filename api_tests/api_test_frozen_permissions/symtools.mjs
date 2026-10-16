/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/symtools.mjs
 *	@Date: 2026-10-13T06:30:11-07:00 (1791898211)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T11:45:56-07:00 (1792176356)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture: an object holding, under a symbol key, an object whose own symbol-keyed member is a terminal value.
 */

const outer = Symbol.for("slothlet.test.symOuter");
const inner = Symbol.for("slothlet.test.symInner");

export const holder = {};
holder[outer] = { [inner]: "SYMSECRET" };
