/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-mutations.test.vitest.mjs
 *	@Date: 2026-05-30 00:00:00 -07:00 (1748563200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Integration tests for runtime API mutation operations in browser mode.
 *
 * @description
 * Browser mode activates a manifest-based, filesystem-free composition path. This suite
 * verifies that the three runtime mutation surfaces — `api.slothlet.api.remove`,
 * `api.slothlet.api.reload` (path-scoped), and `api.slothlet.reload` (full-instance) —
 * behave correctly (or predictably fail) under browser mode (i.e. when `manifest` is
 * provided), and investigates `api.slothlet.api.modules.addModule(s)` reachability.
 *
 * Covers (all under browser mode, via the full matrix):
 * - `api.slothlet.api.remove(path)` returns `true` after mounting a manifest subdirectory
 * - `api.slothlet.api.remove` on an unknown path returns `false`
 * - `api.slothlet.api.remove` deletes a fully materialized mount from the bound api proxy in
 *   every mode (regression for the eager+browser owner-attribution leak — a re-mounted base leaf
 *   was registered under base, so remove rolled it back instead of deleting; fixed in
 *   UnifiedWrapper.___createChildWrapper)
 * - `api.slothlet.api.reload(path)` re-loads an `api.add`-mounted subdirectory; leaves
 *   remain callable and return correct values after reload
 * - `api.slothlet.reload()` (full-instance) FINDING: throws
 *   `INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID` in browser mode because the saved
 *   internal config has `resolveModuleSpecifier: null` (not `undefined`), which fails the
 *   validation guard in `transformConfig`. This is issue #91.
 * - `api.slothlet.api.modules.addModule(s)` — FINDING: node-only in practice; `discover()`
 *   calls `discoverModules()` which uses `node:fs/promises` behind `platform.mjs`. In a real
 *   browser where `fsp === null` this throws a TypeError. Node-side browser-mode simulations
 *   happen to reach the filesystem because `isNode` is `true` in all vitest runs.
 *
 * @module tests/vitests/suites/browser/browser-mutations
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a browser-mode config, optionally extending it with extra overrides.
 * @param {object} matrixConfig
 * @param {object} [extra]
 * @returns {object}
 */
function browserCfg(matrixConfig, extra = {}) {
	return { ...makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST), ...extra };
}

// ─── 1. api.slothlet.api.remove — core behaviour ──────────────────────────────

describe.each(getMatrixConfigs())("Browser Mode > api.slothlet.api.remove > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("remove() returns true after mounting a manifest subdirectory", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`);
		expect(api.extra).toBeDefined();
		expect(await api.extra.format.upper("hello")).toBe("HELLO");

		const result = await api.slothlet.api.remove("extra");
		expect(result).toBe(true);
	});

	it("remove() on a nested dotted-path mount returns true", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("tools.fmt", `${FIXTURE_DIR}/utils`);
		expect(api.tools).toBeDefined();
		expect(api.tools.fmt).toBeDefined();

		const result = await api.slothlet.api.remove("tools.fmt");
		expect(result).toBe(true);
	});

	it("remove() returns false for a path that was never registered", async () => {
		api = await slothlet(browserCfg(config));

		const result = await api.slothlet.api.remove("ghostPath");
		expect(result).toBe(false);
	});

	it("base api tree leaves remain callable after a successful remove()", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`);
		await api.slothlet.api.remove("extra");

		// The root manifest leaves must still work regardless of the remove result on `extra`
		expect(api.math.add(2, 3)).toBe(5);
		expect(api.auth.logout()).toEqual({ ok: true });
	});
});

// ─── remove() clears a materialized property (regression for the eager+browser owner leak) ────
//
// A mounted module's leaves must be DELETED on remove() — even after the mount was fully
// materialized (a nested leaf called before the remove). This previously failed only in EAGER
// browser mode: api.add re-runs the eager build, and its child wrappers inherited base's moduleID
// from the shared leaf functions' existing metadata, so ownership stacked the new module on top
// of base and remove() rolled the leaves back to base instead of deleting them (impl:removed also
// never fired). Fixed by preferring the parent/build owner in UnifiedWrapper.___createChildWrapper.
// Runs the full matrix so eager AND lazy are covered (the original tests had a config-destructuring
// bug — they passed the {name, config} wrapper to browserCfg, so both ran eager and masked the lazy
// path entirely).

describe.each(getMatrixConfigs())("Browser Mode > api.slothlet.api.remove clears the property > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a fully materialized mount is removed from the bound api proxy", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`);
		// Materialize the mount (call a nested leaf) before removing it.
		expect(await api.extra.format.upper("hello")).toBe("HELLO");

		expect(await api.slothlet.api.remove("extra")).toBe(true);
		expect(api.extra).toBeUndefined();
	});
});

// ─── 2. api.slothlet.api.reload (path-scoped) ────────────────────────────────

describe.each(getMatrixConfigs())("Browser Mode > api.slothlet.api.reload (path-scoped) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("reloads a mounted subdirectory path — leaves remain callable", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`);
		expect(await api.extra.format.upper("before")).toBe("BEFORE");

		// Reload by the exact path used in the add call
		await expect(api.slothlet.api.reload("extra")).resolves.toBeUndefined();

		// Leaf must still be callable after reload
		expect(await api.extra.format.upper("after")).toBe("AFTER");
	});

	it("reloads the base module path via '.' — root-level leaves still work", async () => {
		api = await slothlet(browserCfg(config));

		// Reloading '.' targets the base module (the root manifest)
		await expect(api.slothlet.api.reload(".")).resolves.toBeUndefined();

		// Root leaves remain intact after base-module reload
		expect(api.math.add(2, 3)).toBe(5);
		expect(api.auth.logout()).toEqual({ ok: true });
	});

	it("reloads a sub-leaf path under the base module — parent-cache fallback works", async () => {
		api = await slothlet(browserCfg(config));

		// 'math' lives under the base module; reload("math") hits the parent-cache
		// fallback path (_findAffectedCaches) and rebuilds the base module cache
		await expect(api.slothlet.api.reload("math")).resolves.toBeUndefined();
		expect(api.math.add(4, 5)).toBe(9);
	});

	it("throws INVALID_API_PATH when reloading a path that does not exist", async () => {
		api = await slothlet(browserCfg(config));

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.reload("nonExistentPath")).rejects.toThrow("INVALID_API_PATH");
		});
	});

	it("reload with empty-string path targets the base module", async () => {
		api = await slothlet(browserCfg(config));

		await expect(api.slothlet.api.reload("")).resolves.toBeUndefined();
		expect(api.math.add(1, 2)).toBe(3);
	});
});

// ─── FINDING: api.slothlet.reload() (full-instance) fails in browser mode ────
//
// `api.slothlet.reload()` (the FULL-instance reload) throws
// `INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID` when called in browser mode.
//
// Root cause: `Slothlet.reload()` calls `this.load(this.config, ...)` to rebuild the
// instance. `this.config` is the normalized internal config, which stores
// `resolveModuleSpecifier: null` (line ~459 of config.mjs). When that value is passed
// back into `transformConfig()`, the guard at line 330 checks:
//
//   if (config.resolveModuleSpecifier !== undefined && typeof config.resolveModuleSpecifier !== "function")
//
// Since `null !== undefined` is true, and `typeof null === "object"` (not `"function"`),
// the guard throws. A secondary `CONTEXT_NOT_FOUND` error surfaces during `shutdown()`
// in the afterEach because the reload created a new instanceID that the context manager
// no longer tracks after the failed load.
//
// Scope: `api.slothlet.api.reload(path)` (path-scoped, above) is UNAFFECTED — it
// rebuilds from the cache without re-running `transformConfig`. Only the full-instance
// `api.slothlet.reload()` is broken. This is issue #91.

describe("Browser Mode > api.slothlet.reload (full-instance) > FINDING: broken in browser mode (issue #91)", () => {
	it("FINDING: api.slothlet.reload() throws INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID because the saved config has resolveModuleSpecifier: null", async () => {
		const [{ config: matrixConfig }] = getMatrixConfigs({ mode: "eager", runtime: "async", hook: { enabled: false } });
		const api = await slothlet(browserCfg(matrixConfig));

		// Full-instance reload fails in browser mode due to the null resolveModuleSpecifier bug
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID");
		});

		// Shutdown may also throw CONTEXT_NOT_FOUND as a cascade from the failed reload;
		// suppress it so the test report is clean and focused on the primary finding.
		await api.shutdown().catch(() => {});
	});
});

// ─── 3. api.slothlet.api.modules.addModule(s) — investigation ────────────────
//
// FINDING: `addModule(s)` is NODE-ONLY in practice. The call chain is:
//
//   addModule(nameOrResult)
//   → #resolveToDiscoverResult() [if cache empty, calls this.discover()]
//   → discover() → dynamic import("@cldmv/slothlet/helpers/module-discovery")
//   → discoverModules() → fsp.stat(scanRoot) via platform.mjs
//
// In a real browser / worker host, `platform.mjs` sets `fsp = null` (the `isNode = false`
// branch). Any `fsp.stat(...)` call then throws `TypeError: Cannot read properties of null`.
// This TypeError is the only guard — there is no SlothletError with a helpful code.
//
// In this Node-side test environment `isNode = true` even when `manifest` is provided,
// so the filesystem path is reachable. Passing a DiscoverResult directly to `addModule`
// also reaches `addApiComponent` which ultimately calls `scanDirectory`, which in browser
// mode uses `#scanDirectoryBrowser`. That path works because it reads from the manifest
// in memory rather than the filesystem. So passing a pre-built DiscoverResult object to
// `addModule` would theoretically mount in browser mode, but there is no way to produce
// a valid DiscoverResult without first calling `discover()` (which is filesystem-bound).
//
// Read-only methods (getDiscoveryCache, clearDiscoveryCache, getStaleMounts, sort) do
// not touch the filesystem and work correctly in all modes.

describe("Browser Mode > api.slothlet.api.modules — investigation", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("modules namespace is exposed and structurally intact in browser mode", async () => {
		const [{ config: matrixConfig }] = getMatrixConfigs({ mode: "eager", runtime: "async", hook: { enabled: false } });
		api = await slothlet(browserCfg(matrixConfig));

		const mm = api.slothlet.api.modules;
		expect(mm).toBeDefined();
		expect(typeof mm.addModule).toBe("function");
		expect(typeof mm.addModules).toBe("function");
		expect(typeof mm.discover).toBe("function");
		expect(typeof mm.removeModule).toBe("function");
		expect(typeof mm.sort).toBe("function");
	});

	it("read-only modules methods work correctly in browser mode", async () => {
		const [{ config: matrixConfig }] = getMatrixConfigs({ mode: "eager", runtime: "async", hook: { enabled: true } });
		api = await slothlet(browserCfg(matrixConfig));

		const mm = api.slothlet.api.modules;

		// All read-only accessors must work without touching the filesystem
		const cache = mm.getDiscoveryCache();
		expect(Array.isArray(cache)).toBe(true);
		expect(cache.length).toBe(0); // empty until discover() is called

		mm.clearDiscoveryCache();
		expect(mm.getDiscoveryCache().length).toBe(0);

		const stale = mm.getStaleMounts();
		expect(Array.isArray(stale)).toBe(true);
		expect(stale.length).toBe(0);
	});

	it("read-only modules methods work in lazy browser mode too", async () => {
		const [{ config: matrixConfig }] = getMatrixConfigs({ mode: "lazy", runtime: "live", hook: { enabled: false } });
		api = await slothlet(browserCfg(matrixConfig));

		const mm = api.slothlet.api.modules;
		expect(Array.isArray(mm.getDiscoveryCache())).toBe(true);
		expect(Array.isArray(mm.getStaleMounts())).toBe(true);
		expect(Array.isArray(mm.sort([]))).toBe(true);
	});
});
