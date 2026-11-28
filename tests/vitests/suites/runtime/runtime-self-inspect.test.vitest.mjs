/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/runtime/runtime-self-inspect.test.vitest.mjs
 *	@Date: 2026-11-25T01:33:02-08:00 (1795599182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:59-08:00 (1795869179)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Inspecting the runtime `self` from outside any slothlet call shows an empty object: there is no
 * instance whose api it could stand for.
 *
 * @module tests/vitests/suites/runtime/runtime-self-inspect.test.vitest
 */

import { inspect } from "node:util";
import { describe, it, expect } from "vitest";
import { self } from "@cldmv/slothlet/runtime";

describe("runtime self — inspected outside a call", () => {
	it("shows an empty object", () => {
		expect(inspect(self)).toBe("{}");
	});
});
