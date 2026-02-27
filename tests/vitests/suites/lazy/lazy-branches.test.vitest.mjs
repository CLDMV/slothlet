/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-branches.test.vitest.mjs
 *	@Date: 2026-02-27T00:00:00-08:00 (1772169600)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-27 00:00:00 -08:00 (1772169600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motion Inc. All rights reserved.
 */

/**
 * @fileoverview Branch-coverage tests for LazyMode.createNamedMaterializeFunc (lazy.mjs lines 49–52).
 *
 * @description
 * The ternary on lazy.mjs lines 49–52 has three branches:
 *
 *   1. `safePath && /^[A-Za-z_$]/.test(safePath[0])` → use safePath as-is.
 *      e.g. apiPath = "api.math"  → normalized = "api__math"   → funcName = "api__math__lazy_materializeFunc"
 *      (this is the hot path, well covered by existing tests)
 *
 *   2. `safePath ? \`_${safePath}\`` → safePath is non-empty but starts with a digit/non-ident char.
 *      e.g. apiPath = "123abc"    → safePath = "123abc"         → normalized = "_123abc"
 *      e.g. apiPath = "2.deep"    → safePath = "2__deep"        → normalized = "_2__deep"
 *      **← THIS BRANCH WAS UNCOVERED (lines 49–52 branch 2)**
 *
 *   3. `"api"` fallback → safePath is an empty string after all replacements.
 *      (confirmed dead: `apiPath || "api"` guard ensures safePath is always non-empty)
 *
 * Only branch 2 needed explicit testing.
 *
 * @module tests/vitests/suites/lazy/lazy-branches
 */

import { describe, it, expect, vi } from "vitest";
import { LazyMode } from "@cldmv/slothlet/modes/lazy";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a minimal mock slothlet instance acceptable to ComponentBase.
 * @returns {object} Minimal slothlet mock
 */
function makeMockSlothlet() {
	return {
		config: {},
		debug: vi.fn(),
		SlothletError: null,
		SlothletWarning: null
	};
}

// ─── createNamedMaterializeFunc branch 2: digit-prefixed path (lines 49-52) ──

describe("LazyMode.createNamedMaterializeFunc — _-prefixed normalized name when path starts with digit (lines 49-52)", () => {
	let lm;

	lm = new LazyMode(makeMockSlothlet());

	it("apiPath starting with a digit produces a function named _<path>__lazy_materializeFunc (line 50: _${safePath} branch)", () => {
		const fn = lm.createNamedMaterializeFunc("123abc", async () => ({ value: 1 }));
		// safePath = "123abc" (no dots, no special chars)
		// /^[A-Za-z_$]/.test("1") === false → branch 2 → normalized = "_123abc"
		expect(fn.name).toBe("_123abc__lazy_materializeFunc");
	});

	it("returned function from digit-prefixed path is callable and returns handler result", async () => {
		const handler = vi.fn().mockResolvedValue({ result: "ok" });
		const fn = lm.createNamedMaterializeFunc("9dotted.path", handler);
		// safePath = "9dotted__path"
		// /^[A-Za-z_$]/.test("9") === false → branch 2 → normalized = "_9dotted__path"
		expect(fn.name).toBe("_9dotted__path__lazy_materializeFunc");
		const result = await fn();
		expect(result).toEqual({ result: "ok" });
		expect(handler).toHaveBeenCalledOnce();
	});

	it("passes arguments through to handler", async () => {
		const handler = vi.fn().mockResolvedValue("done");
		const fn = lm.createNamedMaterializeFunc("42", handler);
		await fn("arg1", "arg2");
		expect(handler).toHaveBeenCalledWith("arg1", "arg2");
	});

	// ─── branch 1: normal valid identifier path (regression/sanity) ───────────

	it("apiPath starting with a letter produces function named <path>__lazy_materializeFunc (branch 1 — regression)", () => {
		const fn = lm.createNamedMaterializeFunc("api.math", async () => ({}));
		// dots → "__", so safePath = "api__math"
		// /^[A-Za-z_$]/.test("a") === true → branch 1 → normalized = "api__math"
		expect(fn.name).toBe("api__math__lazy_materializeFunc");
	});

	it("apiPath starting with _ produces function using safePath directly (branch 1)", () => {
		const fn = lm.createNamedMaterializeFunc("_private.path", async () => ({}));
		// safePath = "_private__path"
		// /^[A-Za-z_$]/.test("_") === true → branch 1 → normalized = "_private__path"
		expect(fn.name).toBe("_private__path__lazy_materializeFunc");
	});

	it("apiPath starting with $ produces function using safePath directly (branch 1)", () => {
		const fn = lm.createNamedMaterializeFunc("$scope.thing", async () => ({}));
		// safePath = "$scope__thing"
		// /^[A-Za-z_$]/.test("$") === true → branch 1 → normalized = "$scope__thing"
		expect(fn.name).toBe("$scope__thing__lazy_materializeFunc");
	});

	it("null/undefined apiPath falls back to safePath='api' (branch 1 via fallback)", () => {
		// apiPath || "api" → "api"; "api" starts with letter → branch 1
		const fn = lm.createNamedMaterializeFunc(null, async () => ({}));
		expect(fn.name).toBe("api__lazy_materializeFunc");
	});
});
