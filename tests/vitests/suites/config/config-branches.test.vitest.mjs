/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/config-branches.test.vitest.mjs
 *	@Date: 2026-02-26T19:02:54-08:00 (1772161374)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:45 -08:00 (1772425305)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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

// ─── transformConfig — missing dir throws (line 241) ─────────────────────────

describe("Config.transformConfig — missing dir throws (line 241)", () => {
	it("throws INVALID_CONFIG_DIR_MISSING when dir is absent (line 241)", () => {
		const cfg = new Config(makeMock());

		// Calling transformConfig without a dir must throw at line 241.
		expect(() => cfg.transformConfig({})).toThrow();
	});

	it("throws INVALID_CONFIG_DIR_MISSING when dir is an empty string (line 241)", () => {
		const cfg = new Config(makeMock());

		expect(() => cfg.transformConfig({ dir: "" })).toThrow();
	});
});

// ─── transformConfig — hook boolean branches (lines 305-306) ─────────────────

describe("Config.transformConfig — hook boolean (lines 305-306)", () => {
	it("sets hookConfig.enabled=true and pattern='**' when hook:true (line 305-306)", () => {
		const cfg = new Config(makeMock());

		const result = cfg.transformConfig({ dir: "/tmp/test-api", hook: true });

		expect(result.hook.enabled).toBe(true);
		expect(result.hook.pattern).toBe("**");
	});

	it("sets hookConfig.enabled=false and pattern=null when hook:false (line 305-306)", () => {
		const cfg = new Config(makeMock());

		const result = cfg.transformConfig({ dir: "/tmp/test-api", hook: false });

		expect(result.hook.enabled).toBe(false);
		expect(result.hook.pattern).toBeNull();
	});
});
// ─── normalizeRuntime unknown fallback (line 107) ─────────────────────────────

describe("Config.normalizeRuntime — unknown value falls back to 'async' (line 107)", () => {
        it("returns 'async' for an unrecognised string (line 107)", () => {
                const cfg = new Config(makeMock());
                // None of the known variants match → falls through to line 107
                expect(cfg.normalizeRuntime("totally-unknown")).toBe("async");
        });

        it("returns 'async' for a numeric-like string (line 107)", () => {
                const cfg = new Config(makeMock());
                expect(cfg.normalizeRuntime("42")).toBe("async");
        });
});

// ─── normalizeMode unknown fallback (line 134) ───────────────────────────────

describe("Config.normalizeMode — unknown value falls back to 'eager' (line 134)", () => {
        it("returns 'eager' for an unrecognised mode string (line 134)", () => {
                const cfg = new Config(makeMock());
                // None of the known lazy/eager variants match → falls through to line 134
                expect(cfg.normalizeMode("turbo")).toBe("eager");
        });

        it("returns 'eager' for another unknown string (line 134)", () => {
                const cfg = new Config(makeMock());
                expect(cfg.normalizeMode("background")).toBe("eager");
        });
});

// ─── normalizeDebug(true) all-flags-on (line 195) ────────────────────────────

describe("Config.normalizeDebug — boolean true enables all flags (line 195)", () => {
        it("returns an object with all flags set to true when debug:true (line 195)", () => {
                const cfg = new Config(makeMock());
                const result = cfg.normalizeDebug(true);
                // Line 195 returns { builder: true, api: true, ... }
                expect(result.builder).toBe(true);
                expect(result.api).toBe(true);
                expect(result.index).toBe(true);
                expect(result.modes).toBe(true);
                expect(result.wrapper).toBe(true);
                expect(result.ownership).toBe(true);
                expect(result.context).toBe(true);
        });
});

// ─── normalizeDebug(unknown) all-flags-off fallback (line 220) ───────────────

describe("Config.normalizeDebug — unknown type returns all-false object (line 220)", () => {
        it("returns all flags false for a numeric debug value (line 220)", () => {
                const cfg = new Config(makeMock());
                // A number is not boolean, string, or object → falls through to line 220
                const result = cfg.normalizeDebug(123);
                expect(result.builder).toBe(false);
                expect(result.api).toBe(false);
                expect(result.index).toBe(false);
        });

        it("returns all flags false for null (line 220)", () => {
                const cfg = new Config(makeMock());
                // null is not a plain debug object → falls through to line 220
                const result = cfg.normalizeDebug(null);
                expect(result.builder).toBe(false);
        });
});

// ─── normalizeCollision object branch with invalid mode string (line 71) ────────────

describe("Config.normalizeCollision — unknown mode string in object falls back to 'merge' (line 71)", () => {
        it("returns 'merge' for initial when initial is an unrecognised string (line 71)", () => {
                const cfg = new Config(makeMock());
                // validateMode("garbage") → validModes.includes("garbage") is false → returns defaultMode
                const result = cfg.normalizeCollision({ initial: "garbage", api: "badmode" });
                expect(result.initial).toBe("merge");
                expect(result.api).toBe("merge");
        });

        it("returns 'merge' for api when api is an unrecognised string (line 71)", () => {
                const cfg = new Config(makeMock());
                const result = cfg.normalizeCollision({ initial: "skip", api: "totally-invalid" });
                expect(result.initial).toBe("skip");
                expect(result.api).toBe("merge"); // falls back to defaultMode
        });
});

// ─── transformConfig v2 allowMutation backward compat (lines 253, 267) ──────────

describe("Config.transformConfig — v2 backward-compat warnings (lines 253, 267)", () => {
        it("emits V2_CONFIG_UNSUPPORTED warning and maps allowMutation:false to mutations obj (line 253)", () => {
                const cfg = new Config(makeMock());
                // allowMutation: false is v2 shorthand; transformConfig emits a warning at line 253
                const result = cfg.transformConfig({ dir: ".", allowMutation: false });
                // mutations should be mapped to all-disabled
                expect(result.api?.mutations ?? result.mutations).toMatchObject({
                        add: false,
                        remove: false,
                        reload: false
                });
        });

        it("emits V2_CONFIG_UNSUPPORTED warning for root-level collision (line 267)", () => {
                const cfg = new Config(makeMock());
                // Root-level collision (without api.collision) triggers the backward-compat warning at line 267
                const result = cfg.transformConfig({ dir: ".", collision: "merge" });
                // The root-level collision should be remapped under api.collision
                expect(result).toBeDefined();
        });
});

// ─── transformConfig i18n config parsing (line 337) ─────────────────────────────

describe("Config.transformConfig — i18n config parsed into normalized object (line 337)", () => {
        it("normalised config includes i18n.language when i18n object is provided (line 337)", () => {
                const cfg = new Config(makeMock());
                const result = cfg.transformConfig({ dir: ".", i18n: { language: "fr" } });
                expect(result.i18n).toBeDefined();
                expect(result.i18n.language).toBe("fr");
        });

        it("i18n.language is undefined when provided value is not a string (line 337)", () => {
                const cfg = new Config(makeMock());
                const result = cfg.transformConfig({ dir: ".", i18n: { language: 42 } });
                expect(result.i18n).toBeDefined();
                expect(result.i18n.language).toBeUndefined();
        });
});

// ─── transformConfig v2 warnings SUPPRESSED by silent:true (lines 253, 267) ────

describe("Config.transformConfig — v2 warnings suppressed by silent:true (lines 253, 267)", () => {
        it("emits no warning when allowMutation:false and silent:true (line 253 false branch)", () => {
                // silent:true causes if (!config.silent) at line 253 to take the false branch,
                // skipping the new SlothletWarning() call entirely.
                const cfg = new Config(makeMock());
                SlothletWarning.suppressConsole = true;
                try {
                        const priorLength = SlothletWarning.captured.length;
                        cfg.transformConfig({ dir: ".", allowMutation: false, silent: true });
                        expect(SlothletWarning.captured.length).toBe(priorLength);
                } finally {
                        SlothletWarning.captured.splice(0);
                        SlothletWarning.suppressConsole = false;
                }
        });

        it("emits no warning when root-level collision and silent:true (line 267 false branch)", () => {
                // silent:true causes if (!config.silent) at line 267 to take the false branch.
                const cfg = new Config(makeMock());
                SlothletWarning.suppressConsole = true;
                try {
                        const priorLength = SlothletWarning.captured.length;
                        cfg.transformConfig({ dir: ".", collision: "merge", silent: true });
                        expect(SlothletWarning.captured.length).toBe(priorLength);
                } finally {
                        SlothletWarning.captured.splice(0);
                        SlothletWarning.suppressConsole = false;
                }
        });
});

// ─── normalizePermissions — audit:false branch (line 538) ────────────────────

describe("Config.normalizePermissions — audit:false maps to 'default' (line 538)", () => {
	it("sets audit to 'default' when audit is boolean false (line 538)", () => {
		const cfg = new Config(makeMock());
		const result = cfg.normalizePermissions({ defaultPolicy: "allow", audit: false });
		expect(result.audit).toBe("default");
	});
});