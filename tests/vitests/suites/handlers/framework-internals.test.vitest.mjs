/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/framework-internals.test.vitest.mjs
 *	@Date: 2026-08-17 12:00:00 -07:00 (1786993200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-17 12:00:00 -07:00 (1786993200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Object-identity brand registry for framework-internal objects (#283).
 * @module tests/vitests/suites/handlers/framework-internals
 */

import { describe, it, expect } from "vitest";
import { markFrameworkInternal, isFrameworkInternal, FRAMEWORK_MARKER_KEYS } from "#handlers/framework-internals";

describe("handlers > framework-internals brand (#283)", () => {
	it("brands an object and reports it as framework-internal", () => {
		const obj = { __isVersionDispatcher: true };
		expect(markFrameworkInternal(obj)).toBe(obj); // returns the same reference for chaining
		expect(isFrameworkInternal(obj)).toBe(true);
	});

	it("brands a function (callable dispatchers are objects too)", () => {
		const fn = () => {};
		markFrameworkInternal(fn);
		expect(isFrameworkInternal(fn)).toBe(true);
	});

	it("is a no-op for null and primitives (returns the input, brands nothing)", () => {
		expect(markFrameworkInternal(null)).toBe(null);
		expect(markFrameworkInternal("dispatcher")).toBe("dispatcher");
		expect(markFrameworkInternal(42)).toBe(42);
	});

	it("reports non-branded objects, null, and primitives as not framework-internal", () => {
		expect(isFrameworkInternal({})).toBe(false);
		expect(isFrameworkInternal(() => {})).toBe(false);
		expect(isFrameworkInternal(null)).toBe(false);
		expect(isFrameworkInternal("dispatcher")).toBe(false);
		expect(isFrameworkInternal(undefined)).toBe(false);
	});

	it("exposes exactly slothlet's reserved dispatcher marker keys", () => {
		expect(FRAMEWORK_MARKER_KEYS.has("__isVersionDispatcher")).toBe(true);
		expect(FRAMEWORK_MARKER_KEYS.has("__logicalPath")).toBe(true);
		expect(FRAMEWORK_MARKER_KEYS.has("__metadata")).toBe(false);
	});
});
