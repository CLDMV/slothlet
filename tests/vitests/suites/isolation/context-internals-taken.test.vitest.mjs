/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/isolation/context-internals-taken.test.vitest.mjs
 *	@Date: 2026-11-25T01:33:08-08:00 (1795599188)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:57-08:00 (1795869117)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The context factory's internal bindings are taken once by each listed file as it loads: asking again
 * under a listed name from anywhere but that file's own top level is refused.
 *
 * @module tests/vitests/suites/isolation/context-internals-taken.test.vitest
 */

import { describe, it, expect } from "vitest";
import "@cldmv/slothlet/runtime";
import { internals } from "#factories/context";

describe("factories/context internals — a second take", () => {
	it("refuses a listed name that already took them", () => {
		// The runtime module took them as it loaded.
		expect(() => internals("lib/runtime/runtime")).toThrow();
	});

	it("refuses a name that is not listed", () => {
		expect(() => internals("lib/handlers/metadata")).toThrow();
	});
});
