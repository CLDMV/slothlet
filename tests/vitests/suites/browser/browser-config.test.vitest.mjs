/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-config.test.vitest.mjs
 *	@Date: 2026-05-28T00:00:00-07:00 (1779951600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:42-08:00 (1794882522)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unit tests for browser-mode config normalisation and validation.
 *
 * @description
 * Tests `normalizeEnvTarget` (auto-detection + explicit overrides + manifest signal) and
 * the `transformConfig` validation paths active in browser mode:
 * - `manifest` presence auto-triggers browser mode (no `platform: "browser"` needed)
 * - `base` is the primary config option (replaces `dir`)
 * - `resolveModuleSpecifier` is optional — defaults to `new URL(path, base)`
 * - Invalid (non-function) `resolveModuleSpecifier` still throws
 *
 * @module tests/vitests/suites/browser/browser-config
 */

import { describe, it, expect, vi } from "vitest";
import { Config } from "#helpers/config";
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

describe("Config.transformConfig — browser mode validation (platform: 'browser' forced)", () => {
	it("no base with an empty manifest is a no-base browser instance (#471)", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ loader: { platform: "browser", files: VALID_MANIFEST } });
		expect(result.loader.platform).toBe("browser");
		expect(result.base).toBeNull();
	});

	it("no base with a manifest that lists files throws INVALID_CONFIG_DIR_MISSING (the files need a base)", () => {
		const cfg = new Config(makeMock());
		expect(() =>
			cfg.transformConfig({ loader: { platform: "browser", files: { files: [{ path: "a.mjs", name: "a" }], directories: [] } } })
		).toThrow(expect.objectContaining({ code: "INVALID_CONFIG_DIR_MISSING" }));
	});

	it("throws INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST when manifest is absent", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ loader: { platform: "browser" }, base: "/url" })).toThrow(SlothletError);
		try {
			cfg.transformConfig({ loader: { platform: "browser" }, base: "/url" });
		} catch (err) {
			expect(err.code).toBe("INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST");
		}
	});

	it("throws INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST when manifest is null", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ base: "/url", loader: { platform: "browser", files: null } })).toThrow(SlothletError);
	});

	it("throws INVALID_CONFIG_BROWSER_MANIFEST_INVALID when manifest lacks files array", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ base: "/url", loader: { platform: "browser", files: { directories: [] } } })).toThrow(SlothletError);
		try {
			cfg.transformConfig({ base: "/url", loader: { platform: "browser", files: { directories: [] } } });
		} catch (err) {
			expect(err.code).toBe("INVALID_CONFIG_BROWSER_MANIFEST_INVALID");
		}
	});

	it("throws INVALID_CONFIG_BROWSER_MANIFEST_INVALID when manifest lacks directories array", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ base: "/url", loader: { platform: "browser", files: { files: [] } } })).toThrow(SlothletError);
	});

	it("throws INVALID_CONFIG_BROWSER_MANIFEST_INVALID when manifest is a plain string", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ base: "/url", loader: { platform: "browser", files: "not-an-object" } })).toThrow(SlothletError);
	});

	it("throws INVALID_CONFIG_BROWSER_MANIFEST_INVALID when manifest is an array", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ base: "/url", loader: { platform: "browser", files: [] } })).toThrow(SlothletError);
	});

	it("resolveModuleSpecifier is optional — omitting it does NOT throw", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ base: "/url/", loader: { platform: "browser", files: VALID_MANIFEST } })).not.toThrow();
	});

	it("throws INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID when resolveModuleSpecifier is a string", () => {
		const cfg = new Config(makeMock());
		expect(() =>
			cfg.transformConfig({ base: "/url/", loader: { platform: "browser", files: VALID_MANIFEST, resolve: "not-a-function" } })
		).toThrow(SlothletError);
	});

	it("throws INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID when resolveModuleSpecifier is a number", () => {
		const cfg = new Config(makeMock());
		expect(() => cfg.transformConfig({ base: "/url/", loader: { platform: "browser", files: VALID_MANIFEST, resolve: 42 } })).toThrow(
			SlothletError
		);
	});

	it("accepts base + valid manifest and sets envTarget to 'browser'", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/url/", loader: { platform: "browser", files: VALID_MANIFEST } });
		expect(result.loader.platform).toBe("browser");
		expect(result.loader.files).toBe(VALID_MANIFEST);
		expect(result.base).toBe("/url/");
	});

	it("accepts optional resolveModuleSpecifier when provided as a function", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({
			base: "/url/",
			loader: {
				platform: "browser",
				files: VALID_MANIFEST,
				resolve: VALID_RESOLVER
			}
		});
		expect(result.loader.resolve).toBe(VALID_RESOLVER);
	});
});

// ─── transformConfig — manifest auto-triggers browser mode ───────────────────

describe("Config.transformConfig — manifest presence auto-triggers browser mode", () => {
	it("sets envTarget to 'browser' when manifest is provided without platform: 'browser'", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/url/", loader: { files: VALID_MANIFEST } });
		expect(result.loader.platform).toBe("browser");
	});

	it("sets envTarget to 'node' when platform: 'node' is explicit even if manifest is present", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/api", loader: { platform: "node", files: VALID_MANIFEST } });
		expect(result.loader.platform).toBe("node");
	});
});

// ─── transformConfig — base ─────────────────────────────────────────────────

describe("Config.transformConfig — base option", () => {
	it("accepts base as the primary option in node mode", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/api" });
		expect(result.base).toBe("/api");
	});

	it("no base is a no-base instance (#471): base normalizes to null", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({});
		expect(result.base).toBeNull();
	});
});

// ─── transformConfig — node mode unchanged ────────────────────────────────────

describe("Config.transformConfig — node mode unaffected by browser-mode additions", () => {
	it("base is resolved and envTarget is 'node' in node mode", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({ base: "/api" });
		expect(result.loader.platform).toBe("node");
	});

	it("manifest and resolveModuleSpecifier are ignored for envTarget when platform: 'node' is explicit", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({
			base: "/api",
			loader: {
				platform: "node",
				files: VALID_MANIFEST,
				resolve: VALID_RESOLVER
			}
		});
		expect(result.loader.platform).toBe("node");
	});

	it("an absent base in node mode is a no-base instance (#471)", () => {
		const cfg = new Config(makeMock());
		const result = cfg.transformConfig({});
		expect(result.loader.platform).toBe("node");
		expect(result.base).toBeNull();
	});
});
