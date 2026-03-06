/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-debug-paths.test.vitest.mjs
 *	@Date: 2026-03-03T12:00:00-08:00 (1741032000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-05 00:32:12 -08:00 (1772699532)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for unified-wrapper.mjs debug-gated code paths that require
 * `debug: { wrapper: true }` in the slothlet config to fire.
 *
 * @description
 * Several debug-logging blocks in unified-wrapper.mjs are gated on either:
 *   - module-level `wrapperDebugEnabled` (env var SLOTHLET_DEBUG_WRAPPER=1), or
 *   - per-instance `config.debug?.wrapper === true`.
 *
 * These debug paths check `apiPath === "string"` (literal string — covers the
 * api_test "string" module) and fire during lazy materialization:
 *
 *   line  668     `if (debug.wrapper && apiPath === "string")` at start of _materialize
 *                 Triggered by materializing api.string in lazy mode with debug.wrapper=true.
 *
 *   line  680     Inside the materializationPromise async IIFE — same debug+string check
 *                 before calling materializeFunc.
 *
 *   line  705     After materializeFunc completes — logs materialization complete.
 *
 *   line  541     `_applyNewImpl` update path check — apiPath==="string"+debug.wrapper.
 *                 Triggered when impl is set on the string wrapper during materialization.
 *
 *   line  279     `___createChildWrapper` constructor path — apiPath starts with "config"
 *                 Triggered when creating child wrappers for the config module.
 *
 *   line  288     Same config-path debug, second branch in constructor.
 *
 * Lines 603-616 (___invalidate children loop) and lines 764-775 (_clearState loop):
 *   Triggered by reload/remove operations that clear wrapper children. Any reload
 *   of a non-leaf module (like api.string) should sweep child wrappers.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-debug-paths
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

// This suite intentionally enables config.debug.wrapper=true for branch coverage.
// Suppress the resulting console noise — we don't assert on emitted debug lines.
suppressSlothletDebugOutput();

let api;

afterEach(async () => {
	if (api?.shutdown) await api.shutdown();
	api = null;
	await new Promise((r) => setTimeout(r, 30));
});

// ---------------------------------------------------------------------------
// 1. debug.wrapper=true in lazy mode — lines 668, 680, 705
//    The "string" module (apiPath="string") materializes lazily.
//    With debug.wrapper=true, _materialize() logs START, CALLING_FUNC, COMPLETE.
// ---------------------------------------------------------------------------
describe("debug.wrapper=true materialisation paths for lazy 'string' module", () => {
	it("materialising api.string with debug.wrapper=true covers debug start/complete (lazy)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			debug: { wrapper: true }
		});

		// Accessing api.string.upper triggers lazy materialization of the "string" module.
		// With debug.wrapper: true, lines 668, 680, 705 fire (if apiPath === "string").
		const result = await api.string.upper("hello");
		expect(result).toBe("HELLO");
	});

	it("materialising api.string.reverse with debug.wrapper=true (lazy)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			debug: { wrapper: true }
		});

		const result = await api.string.reverse("abc");
		expect(result).toBe("cba");
	});

	it("materialization via explicit _materialize() call also fires debug paths (lazy)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			debug: { wrapper: true }
		});

		// Call _materialize() on string proxy directly — string was previously unmaterialized
		const stringProxy = api.string;
		if (typeof stringProxy?._materialize === "function") {
			await stringProxy._materialize();
		}

		const result = await api.string.upper("world");
		expect(result).toBe("WORLD");
	});
});

// ---------------------------------------------------------------------------
// 2. debug.wrapper=true + eager mode — ___createChildWrapper debug paths
//    Lines 279, 288 fire when a config-path module creates child wrappers.
// ---------------------------------------------------------------------------
describe("debug.wrapper=true constructor paths for 'config' module (eager)", () => {
	it("creating api with debug.wrapper=true in eager mode fires config-path constructor debug", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			debug: { wrapper: true }
		});

		// The "config" module's apiPath starts with "config" — triggers lines 279, 288
		// during child wrapper creation in eager mode.
		expect(api.config).toBeDefined();
		// Just confirm structure, lines 279/288 fire during api build
	});

	it("accessing config properties after eager build with debug does not throw (eager)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			debug: { wrapper: true }
		});

		const configType = typeof api.config;
		expect(["function", "object"]).toContain(configType);
	});
});

// ---------------------------------------------------------------------------
// 3. ___invalidate children loop — lines 604-614
//    Any reload of a parent module should call ___invalidate() on the wrapper,
//    which loops over Reflect.ownKeys(this) to invalidate child wrappers.
// ---------------------------------------------------------------------------
describe("___invalidate children loop — lines 604-614", () => {
	it("reloading a parent module invalidates child wrapper loop (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		// Reload math — its wrapper ___invalidate() is called which loops over
		// child keys (add, subtract, multiply...) and calls ___invalidate() on each.
		// This triggers the Reflect.ownKeys loop starting at line 604.
		await expect(api.slothlet.api.reload("math")).resolves.not.toThrow();
		expect(api.math.add).toBeDefined();
	});

	it("reloading multi_func parent module invalidates nested child wrappers (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		// multi_func is a folder module with multiple nested modules as children
		await expect(api.slothlet.api.reload("multi_func")).resolves.not.toThrow();
		expect(api.multi_func).toBeDefined();
	});

	it("reloading nested folder module loops over folder children (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		// "nested" is a folder with children like date, time, etc.
		// Reloading it triggers ___invalidate() on the nested wrapper → children loop
		await expect(api.slothlet.api.reload("nested")).resolves.not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 4. _clearState configurable-property deletion loop — lines 764-775
//    Called internally during reload/reassignment to clear old child properties.
// ---------------------------------------------------------------------------
describe("_clearState configurable-property loop — lines 764-775", () => {
	it("reload('math') triggers _clearState on math wrapper (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		expect(api.math.add).toBeDefined();

		// When math reloads, _clearState() is called first to delete old child wrappers.
		// The loop at lines 764-775 iterates Reflect.ownKeys(this) and deletes configurable props.
		await api.slothlet.api.reload("math");
		// Post-reload, add should be restored
		expect(typeof await api.math.add(2, 3)).toBe("number");
	});

	it("repeated reload clears and rebuilds state correctly (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		for (let i = 0; i < 3; i++) {
			await api.slothlet.api.reload("string");
		}
		// After 3 reloads, string should still work
		const result = await api.string.upper("test");
		expect(result).toBe("TEST");
	});
});

// ---------------------------------------------------------------------------
// 5. debug.wrapper=true + lazy + waiting proxy apply-trap debug paths
//    Lines 1667, 1668 — DEBUG_MODE_WAITING_APPLY_ENTRY fires at apply-trap entry
//    with debug.wrapper=true.
// ---------------------------------------------------------------------------
describe("waiting proxy apply-trap with debug.wrapper=true", () => {
	it("awaiting lazy string.upper with debug.wrapper=true fires apply-trap debug (lazy)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			debug: { wrapper: true }
		});

		// First access: string is unmaterialized → waiting proxy created (inFlight triggers)
		// Calling the waiting proxy → apply trap fires → debug lines 1667, 1668 execute
		// (if wrapperDebugEnabled || config.debug.wrapper && "string" path check)
		const result = await api.string.upper("lazy-debug");
		expect(result).toBe("LAZY-DEBUG");
	});

	it("calling lazy multi_func.alpha with debug fires apply-trap debug (lazy)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			debug: { wrapper: true }
		});

		const result = await api.multi_func.alpha("x");
		expect(typeof result).toBe("string");
	});
});
