/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-config.test.vitest.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 08:10:30 -07:00 (1779981030)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit tests for browser-mode config normalisation and validation.
 *
 * @description
 * Tests `normalizeEnvTarget` (auto-detection + explicit overrides + manifest signal) and
 * the `transformConfig` validation paths active in browser mode:
 * - `manifest` presence auto-triggers browser mode (no `env: "browser"` needed)
 * - `base` is the primary config option (replaces `dir`)
 * - `dir` is a deprecated alias for `base` — emits `V3_CONFIG_DEPRECATED`
 * - `resolveModuleSpecifier` is optional — defaults to `new URL(path, base)`
 * - Invalid (non-function) `resolveModuleSpecifier` still throws
 *
 * @module tests/vitests/suites/browser/browser-config
 */

import { describe, it, expect, vi } from "vitest";
import { Config } from "@cldmv/slothlet/helpers/config";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Minimal mock slothlet satisfying Config's ComponentBase requirements.
 * The resolver returns the dir string unchanged (identity).
 *
 * @returns {object} Mock slothlet instance.
 *
 * @example
 * const cfg = new Config(makeMock());
 */
function makeMock() {
	return {
		config: {},
		envTarget: "node",
		debug: vi.fn(),
		SlothletError,
		SlothletWarning,
		helpers: {
			resolver: {
				/**
				 * Identity path resolver — returns the input unchanged.
				 * @param {string} dir
				 * @returns {string}
				 */
				resolvePathFromCaller: (dir) => dir
			}
		}
	};
}

/**
 * Minimal valid manifest used as a baseline across multiple tests.
 * @type {{ files: Array, directories: Array }}
 */
const VALID_MANIFEST = { files: [], directories: [] };

/**
 * Minimal valid `resolveModuleSpecifier` callback.
 * @type {Function}
 */
const VALID_RESOLVER = () => "/mock/module.mjs";

// ─── normalizeEnvTarget ───────────────────────────────────────────────────────

describe("Config.normalizeEnvTarget — explicit overrides", () => {
	it("returns 'browser' when rawEnv is exactly 'browser'", () => {
		const cfg = new Config(makeMock());
		expect(cfg.normalizeEnvTarget("browser")).toBe("browser");
	});

	it("returns 'node' when rawEnv is exactly 'node'", () => {
		const cfg = new Config(makeMock());
		expect(cfg.normalizeEnvTarget("node")).toBe("node");
	});

	it("returns 'node' when rawEnv is 'node' even if hasManifest is true", () => {
		const cfg = new Config(makeMock());
		// Explicit 'node' always wins over manifest signal
		expect(cfg.normalizeEnvTarget("node", true)).toBe("node");
	});
});

describe("Config.normalizeEnvTarget — auto-detection in Node.js test environment", () => {
	it("returns 'node' when rawEnv is undefined (process.versions.node is set in vitest)", () => {
		const cfg = new Config(makeMock());
		// Running inside Node.js: process.versions.node is always a string here.
		expect(cfg.normalizeEnvTarget(undefined)).toBe("node");
	});

	it("returns 'node' when rawEnv is null", () => {
		const cfg = new Config(makeMock());
		expect(cfg.normalizeEnvTarget(null)).toBe("node");
	});

	it("returns 'node' for any unrecognised string (falls through to auto-detect)", () => {
		const cfg = new Config(makeMock());
		expect(cfg.normalizeEnvTarget("worker")).toBe("node");
		expect(cfg.normalizeEnvTarget("electron")).toBe("node");
	});
});

describe("Config.normalizeEnvTarget — manifest as browser-mode signal", () => {
	it("returns 'browser' when hasManifest is true and rawEnv is undefined", () => {
		const cfg = new Config(makeMock());
		expect(cfg.normalizeEnvTarget(undefined, true)).toBe("browser");
	});

	it("returns 'browser' when hasManifest is true and rawEnv is null", () => {
		const cfg = new Config(makeMock());
		expect(cfg.normalizeEnvTarget(null, true)).toBe("browser");
	});

	it("returns 'browser' when hasManifest is true and rawEnv is 'browser'", () => {
		const cfg = new Config(makeMock());
		expect(cfg.normalizeEnvTarget("browser", true)).toBe("browser");
	});
});

// ─── transformConfig — browser validation ────────────────────────────────────

describe("Config.transformConfig — browser mode validation (env: 'browser' forced)", () => {
	it("throws INVALID_CONFIG_DIR_MISSING when neither base nor dir is provided", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ env: "browser", manifest: VALID_MANIFEST })).toThrow(SlothletError);
		try {
			cfg.transformConfig({ env: "browser", manifest: VALID_MANIFEST });
		} catch (err) {
			expect(err.code).toBe("INVALID_CONFIG_DIR_MISSING");
		}
	});

	it("throws INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST when manifest is absent", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ env: "browser", base: "/url" })).toThrow(SlothletError);
		try {
			cfg.transformConfig({ env: "browser", base: "/url" });
		} catch (err) {
			expect(err.code).toBe("INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST");
		}
	});

	it("throws INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST when manifest is null", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ env: "browser", base: "/url", manifest: null })).toThrow(SlothletError);
	});

	it("throws INVALID_CONFIG_BROWSER_MANIFEST_INVALID when manifest lacks files array", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ env: "browser", base: "/url", manifest: { directories: [] } })).toThrow(SlothletError);
		try {
			cfg.transformConfig({ env: "browser", base: "/url", manifest: { directories: [] } });
		} catch (err) {
			expect(err.code).toBe("INVALID_CONFIG_BROWSER_MANIFEST_INVALID");
		}
	});

	it("throws INVALID_CONFIG_BROWSER_MANIFEST_INVALID when manifest lacks directories array", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ env: "browser", base: "/url", manifest: { files: [] } })).toThrow(SlothletError);
	});

	it("throws INVALID_CONFIG_BROWSER_MANIFEST_INVALID when manifest is a plain string", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ env: "browser", base: "/url", manifest: "not-an-object" })).toThrow(SlothletError);
	});

	it("throws INVALID_CONFIG_BROWSER_MANIFEST_INVALID when manifest is an array", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ env: "browser", base: "/url", manifest: [] })).toThrow(SlothletError);
	});

	it("resolveModuleSpecifier is optional — omitting it does NOT throw", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ env: "browser", base: "/url/", manifest: VALID_MANIFEST })).not.toThrow();
	});

	it("throws INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID when resolveModuleSpecifier is a string", () => {
		const cfg = new Config(makeMock());
		expect(() =>
			cfg.transformConfig({ env: "browser", base: "/url/", manifest: VALID_MANIFEST, resolveModuleSpecifier: "not-a-function" })
		).toThrow(SlothletError);
	});

	it("throws INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID when resolveModuleSpecifier is a number", () => {
		const cfg = new Config(makeMock());
		expect(() =>
			cfg.transformConfig({ env: "browser", base: "/url/", manifest: VALID_MANIFEST, resolveModuleSpecifier: 42 })
		).toThrow(SlothletError);
	});

	it("accepts base + valid manifest and sets envTarget to 'browser'", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ env: "browser", base: "/url/", manifest: VALID_MANIFEST });
		expect(result.envTarget).toBe("browser");
		expect(result.manifest).toBe(VALID_MANIFEST);
		expect(result.base).toBe("/url/");
		expect(result.dir).toBe("/url/");
	});

	it("accepts optional resolveModuleSpecifier when provided as a function", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ env: "browser", base: "/url/", manifest: VALID_MANIFEST, resolveModuleSpecifier: VALID_RESOLVER });
		expect(result.resolveModuleSpecifier).toBe(VALID_RESOLVER);
	});
});

// ─── transformConfig — manifest auto-triggers browser mode ───────────────────

describe("Config.transformConfig — manifest presence auto-triggers browser mode", () => {
	it("sets envTarget to 'browser' when manifest is provided without env: 'browser'", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/url/", manifest: VALID_MANIFEST });
		expect(result.envTarget).toBe("browser");
	});

	it("sets envTarget to 'node' when env: 'node' is explicit even if manifest is present", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ env: "node", base: "/api", manifest: VALID_MANIFEST });
		expect(result.envTarget).toBe("node");
	});
});

// ─── transformConfig — base / dir rename ─────────────────────────────────────

describe("Config.transformConfig — base option (primary) and dir deprecation", () => {
	it("accepts base as the primary option in node mode", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/api" });
		expect(result.dir).toBe("/api");
		expect(result.base).toBe("/api");
	});

	it("dir is accepted and emits V3_CONFIG_DEPRECATED warning", () => {
		const mock = makeMock();
		// Must be a regular function (not arrow) since it is called with `new`.
		const warnSpy = vi.spyOn(mock, "SlothletWarning").mockImplementation(function () {});
		const cfg = new Config(mock);
		cfg.transformConfig({ dir: "/api" });
		// V3_CONFIG_DEPRECATED should be raised
		expect(warnSpy).toHaveBeenCalled();
	});

	it("dir does NOT emit a warning when silent: true", () => {
		const mock = makeMock();
		const warnSpy = vi.spyOn(mock, "SlothletWarning").mockImplementation(function () {});
		const cfg = new Config(mock);
		cfg.transformConfig({ dir: "/api", silent: true });
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("base takes precedence over dir when both are provided", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/from-base", dir: "/from-dir", silent: true });
		expect(result.dir).toBe("/from-base");
		expect(result.base).toBe("/from-base");
	});

	it("throws INVALID_CONFIG_DIR_MISSING when neither base nor dir is provided", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({})).toThrow(SlothletError);
		try {
			cfg.transformConfig({});
		} catch (err) {
			expect(err.code).toBe("INVALID_CONFIG_DIR_MISSING");
		}
	});
});

// ─── transformConfig — node mode unchanged ────────────────────────────────────

describe("Config.transformConfig — node mode unaffected by browser-mode additions", () => {
	it("base is resolved and envTarget is 'node' in node mode", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/api" });
		expect(result.envTarget).toBe("node");
	});

	it("manifest and resolveModuleSpecifier are ignored for envTarget when env: 'node' is explicit", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ env: "node", base: "/api", manifest: VALID_MANIFEST, resolveModuleSpecifier: VALID_RESOLVER });
		expect(result.envTarget).toBe("node");
	});

	it("throws INVALID_CONFIG_DIR_MISSING when base is absent in node mode", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({})).toThrow(SlothletError);
		try {
			cfg.transformConfig({});
		} catch (err) {
			expect(err.code).toBe("INVALID_CONFIG_DIR_MISSING");
		}
	});
});
