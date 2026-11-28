/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_frozen_permissions/tools.mjs
 *	@Date: 2026-10-13T03:22:12-07:00 (1791886932)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:04-08:00 (1795868884)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture: an object holding the same function under a string key and a symbol key.
 */

const tag = Symbol.for("slothlet.test.tool");

export const holder = { run: () => "RAN" };
holder[tag] = () => "RAN";
