/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/config/config-branches.test.vitest.mjs
 *      @Date: 2026-07-15T00:00:00-07:00 (1752652800)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-15 00:00:00 -07:00 (1752652800)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for Config helper uncovered branches (lines 309-310, 391, 407).
 *
 * @description
 * Directly instantiates Config to cover three code paths never reached through integration
 * tests:
 *
 * - Lines 309-310: `transformConfig()` — when `hook` is a string value (e.g. "math/**"),
 *   the hook config is set to `{ enabled: true, pattern: config.hook }`.
 *
 * - Line 391: `normalizeTypeScript()` — when `typescript` is an unknown string (not "fast"
 *   or "strict"), the method falls through to `return { enabled: true, mode: "fast" }`.
 *
 * - Line 407: `normalizeTypeScript()` — when `typescript` is a non-string, non-boolean,
 *   non-object value (e.g. a number), the method returns `null` (disabled).
 *
 * @module tests/vitests/suites/config/config-branches.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { Config } from "@cldmv/slothlet/helpers/config";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Minimal mock slothlet satisfying Config's ComponentBase requirements and the
 * `transformConfig` call to `helpers.resolver.resolvePathFromCaller`.
 *
 * @returns {object} Mock slothlet instance.
 *
 * @example
 * const cfg = new Config(makeMock());
 */
function makeMock() {
	return {
		config: {},
		debug: vi.fn(),
		SlothletError,
		SlothletWarning,
		helpers: {
			resolver: {
				/**
				 * Identity resolver — returns `dir` unchanged.
				 * @param {string} dir
				 * @returns {string}
				 */
				resolvePathFromCaller: (dir) => dir
			}
		}
	};
}

// ─── normalizeTypeScript ──────────────────────────────────────────────────────

describe("Config.normalizeTypeScript — uncovered branches", () => {
	it("returns { enabled: true, mode: 'fast' } for an unknown string value (line 391)", () => {
		// Any string that is not "fast" or "strict" should fall through the
		// known-string checks and return the fallback { enabled: true, mode: "fast" }.
		const cfg = new Config(makeMock());

		const result = cfg.normalizeTypeScript("turbospeed");

		expect(result).toEqual({ enabled: true, mode: "fast" });
	});

	it("returns { enabled: true, mode: 'fast' } for another unknown string (line 391)", () => {
		const cfg = new Config(makeMock());

		expect(cfg.normalizeTypeScript("ultra")).toEqual({ enabled: true, mode: "fast" });
	});

	it("returns null for a numeric typescript value (line 407)", () => {
		// A number is not boolean, string, or object — the final fallback returns null.
		const cfg = new Config(makeMock());

		const result = cfg.normalizeTypeScript(42);

		expect(result).toBeNull();
	});

	it("returns null for a Symbol typescript value (line 407)", () => {
		const cfg = new Config(makeMock());

		expect(cfg.normalizeTypeScript(Symbol("ts"))).toBeNull();
	});

	// Confirm already-covered branches still work (regression guard).
	it("returns null when typescript is falsy (existing coverage guard)", () => {
		const cfg = new Config(makeMock());

		expect(cfg.normalizeTypeScript(false)).toBeNull();
		expect(cfg.normalizeTypeScript(undefined)).toBeNull();
		expect(cfg.normalizeTypeScript(null)).toBeNull();
	});

	it("returns fast mode for boolean true (existing coverage guard)", () => {
		const cfg = new Config(makeMock());

		expect(cfg.normalizeTypeScript(true)).toEqual({ enabled: true, mode: "fast" });
	});
});

// ─── transformConfig — hook as string (lines 309-310) ────────────────────────

describe("Config.transformConfig — hook as string (lines 309-310)", () => {
	it("sets hookConfig.enabled=true and hookConfig.pattern to the string value", () => {
		const cfg = new Config(makeMock());

		// Passing hook as a string pattern should reach lines 309-310.
		const result = cfg.transformConfig({ dir: "/tmp/test-api", hook: "math/**" });

		expect(result.hook.enabled).toBe(true);
		expect(result.hook.pattern).toBe("math/**");
		expect(result.hook.suppressErrors).toBe(false);
	});

	it("preserves arbitrary string patterns in hookConfig.pattern (lines 309-310)", () => {
		const cfg = new Config(makeMock());

		const result = cfg.transformConfig({ dir: "/tmp/test-api", hook: "utils/**.mjs" });

		expect(result.hook.enabled).toBe(true);
		expect(result.hook.pattern).toBe("utils/**.mjs");
	});

	it("leaves hook disabled when hook is undefined (regression guard)", () => {
		const cfg = new Config(makeMock());

		const result = cfg.transformConfig({ dir: "/tmp/test-api" });

		expect(result.hook.enabled).toBe(false);
	});
});
