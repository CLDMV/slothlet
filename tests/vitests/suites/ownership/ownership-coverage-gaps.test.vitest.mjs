/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/ownership/ownership-coverage-gaps.test.vitest.mjs
 *	@Date: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for uncovered OwnershipManager branches.
 *
 * @description
 * Covers:
 *   line 247  `getCurrentValue` — true branch of `if (!owner) return undefined`
 *             (owner is null/undefined → path was never registered)
 *   line 279  `getPathHistory` — false branch of `return this.pathToModule.get(apiPath) || []`
 *             (path not in map → `|| []` fallback returned)
 *
 * @module tests/vitests/suites/ownership/ownership-coverage-gaps
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect } from "vitest";
import { OwnershipManager } from "@cldmv/slothlet/handlers/ownership";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Build a minimal mock slothlet for OwnershipManager construction.
 *
 * @returns {object} Minimal mock.
 *
 * @example
 * const o = new OwnershipManager(makeMock());
 */
function makeMock() {
	return {
		config: {},
		debug: () => {},
		SlothletError,
		SlothletWarning
	};
}

// ─── getCurrentValue — owner is null (line 247 true branch) ──────────────────

describe("OwnershipManager.getCurrentValue — returns undefined for unregistered path (line 247 true)", () => {
	it("returns undefined when the path was never registered (line 247 if(!owner) branch)", () => {
		const o = new OwnershipManager(makeMock());

		// pathToModule has no entry for this path → getCurrentOwner returns null
		// → line 247: if (!owner) return undefined → TRUE branch
		const result = o.getCurrentValue("never.registered.path");

		expect(result).toBeUndefined();
	});

	it("returns undefined for empty string path that was never registered", () => {
		const o = new OwnershipManager(makeMock());
		expect(o.getCurrentValue("")).toBeUndefined();
	});

	it("returns a non-undefined value for a registered path (confirms the false branch works)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = function myFn() {};

		o.register({ apiPath: "math.add", moduleID: "mod-test", value: fn, collisionMode: "merge", source: "initial" });

		// Should return the impl (non-undefined) for a registered path
		const result = o.getCurrentValue("math.add");
		expect(result).toBeDefined();
	});
});

// ─── getPathHistory — || [] fallback (line 279 false branch) ─────────────────

describe("OwnershipManager.getPathHistory — returns [] for unregistered path (line 279 alternate)", () => {
	it("returns [] when apiPath is not in pathToModule map (line 279 || [] branch)", () => {
		const o = new OwnershipManager(makeMock());

		// Nothing registered — pathToModule.get returns undefined → || [] fallback
		const result = o.getPathHistory("no.such.path");

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(0);
	});

	it("returns [] for any string path that was never registered", () => {
		const o = new OwnershipManager(makeMock());
		expect(o.getPathHistory("a.b.c")).toEqual([]);
	});

	it("returns a non-empty array for a path that was registered (confirms the truthy branch)", () => {
		const o = new OwnershipManager(makeMock());
		const fn = function testFn() {};

		o.register({ apiPath: "math", moduleID: "mod-math", value: fn, collisionMode: "merge", source: "initial" });

		const history = o.getPathHistory("math");
		expect(history.length).toBeGreaterThan(0);
	});
});
