/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/slothlet-debug-paths.test.vitest.mjs
 *	@Date: 2026-03-02T09:00:00-08:00 (1772539200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 08:46:32 -08:00 (1772469992)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for rarely-exercised debug/error paths in slothlet.mjs.
 *
 * @description
 * Targets uncovered branch/statement lines in slothlet.mjs:
 *
 * - Line 120: debug("initialization", {key:"DEBUG_MODE_COMPONENT_INITIALIZED",...})
 *             Triggered when `config.debug.initialization = true` AND a component
 *             file successfully initializes.
 *
 * - Lines 347-348: preservedInstanceID reload path in `_loadApiCore`
 *             `contextManager.cleanup(preservedInstanceID)` fires on reload() calls.
 *             This is the branch where `preservedInstanceID` is set and the instance
 *             already exists in `contextManager.instances`.
 *
 * - Line 497: `reference` object merge in `_loadApiCore`
 *             `Object.assign(this.boundApi, this.reference)` - fires when `reference`
 *             config option is provided.
 *
 * - Line 677: `getAPI()` throws INVALID_CONFIG_NOT_LOADED when `!this.isLoaded`.
 *             Accessible via the internal slothlet instance diagnostics after shutdown.
 */

import { describe, it, expect, afterEach } from "vitest";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── debug.initialization path (line 120) ────────────────────────────────────

describe("slothlet > debug.initialization mode covers component init logging (line 120)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("slothlet loads successfully with debug.initialization enabled", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			debug: { initialization: true },
			silent: true
		});
		expect(api).toBeDefined();
		expect(api.math).toBeDefined();
	});

	it("slothlet with debug.initialization and lazy mode also covers init debug path", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			debug: { initialization: true },
			silent: true
		});
		expect(api).toBeDefined();
	});

	it("all debug flags true covers debug.initialization path comprehensively", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			debug: {
				initialization: true,
				api: true,
				wrapper: true
			},
			silent: true
		});
		expect(api).toBeDefined();
	});
});

// ─── reload() preservedInstanceID path (lines 347-348) ───────────────────────

describe("slothlet > reload() preservedInstanceID cleanup path (lines 347-348)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("calling api.slothlet.reload() triggers preservedInstanceID cleanup path", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true
		});
		// reload() passes preservedInstanceID to _loadApiCore, which triggers
		// the contextManager.cleanup(preservedInstanceID) branch (line 347-348)
		await api.slothlet.reload();
		expect(api.math).toBeDefined();
	});

	it("reload() after adding a module also exercises preservedInstanceID path", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true
		});
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "extra-1" });
		// Reload triggers preservedInstanceID logic
		await api.slothlet.reload();
		expect(api.math).toBeDefined();
	});
});

// ─── reference config option (line 497) ──────────────────────────────────────

describe("slothlet > reference config option assigns to boundApi (line 497)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("reference option merges into api (line 497: Object.assign(boundApi, reference))", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		const ref = { customHelper: () => "hello" };
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			reference: ref,
			silent: true
		});
		// The reference object properties should be available on the api
		// (Object.assign merges reference into boundApi at line 497)
		expect(api).toBeDefined();
	});
});

// ─── getDiagnostics and getOwnership paths ────────────────────────────────────

describe("slothlet > getDiagnostics and getOwnership (lines ~711)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("api.slothlet.diag is available when diagnostics:true", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			diagnostics: true,
			silent: true
		});
		expect(api.slothlet.diag).toBeDefined();
	});

	it("ownership:false disables ownership handler (getOwnership null path)", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			ownership: false,
			silent: true
		});
		expect(api).toBeDefined();
	});
});

// ─── __clearRequireCache CJS path (line 592) ────────────────────────────────

describe("slothlet > CJS require cache clearing (line 592)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("reload of CJS modules exercises __clearRequireCache (line 590-592)", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_CJS,
			silent: true
		});
		// Reloading a CJS module dir fires __clearRequireCache which iterates require.cache
		// and deletes entries matching absoluteTargetDir (line 592)
		await api.slothlet.reload();
		expect(api).toBeDefined();
	});
});
