/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/inherited.mjs
 *	@Date: 2026-10-13T01:21:54-07:00 (1791879714)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-13T01:24:26-07:00 (1791879866)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture: an array with no own element whose prototype supplies index 0.
 */

export const inh = [];
inh.length = 1;
Object.setPrototypeOf(inh, { 0: "SECRET" });
