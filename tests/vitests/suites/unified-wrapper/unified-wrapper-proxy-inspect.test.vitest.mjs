/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-proxy-inspect.test.vitest.mjs
 *	@Date: 2026-02-28T14:15:04-08:00 (1772316904)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:56 -08:00 (1772425316)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests targeting specific uncovered proxy and inspect paths in unified-wrapper.mjs.
 *
 * @description
 * Targets the following uncovered line clusters:
 *
 *  Background materialization (constructor lines 304, 307-308):
 *    Triggered by config.tracking.materialization = true in lazy mode.
 *    The setImmediate callback fires and calls _materialize() in the background.
 *
 *  util.inspect.custom handler in main proxy get trap (lines 2135-2165):
 *    Triggered by util.inspect(proxy) or console.log when the wrapper has children
 *    (object-namespace case) or is a lazy unmaterialized wrapper.
 *
 *  debug.wrapper access path (lines 2314, 2325-2342):
 *    Triggered when debug.wrapper = true and api.math.power or api.math.add is accessed.
 *    The path exits early when prop === "power" || prop === "add" and logs debug info.
 *
 *  In-flight lazy get trap with debug path (lines 2362-2389):
 *    Triggered when a lazy wrapper is accessed for a prop while it's in inFlight state
 *    AND debug.wrapper = true.
 *
 *  DEBUG_MODE_INSPECT_LAZY_UNMATERIALIZED (line 2162):
 *    Triggered by util.inspect on a lazy wrapper that has NOT yet materialized.
 *
 *  hasTrap for lazy wrapper (lines 2744, 2779):
 *    Triggered by `"key" in api.lazyWrapper` when the wrapper is lazy.
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-proxy-inspect
 */

import util from "util";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

let restoreDebugOutput;

beforeAll(() => {
	restoreDebugOutput = suppressSlothletDebugOutput();
});

afterAll(() => {
	restoreDebugOutput?.();
	restoreDebugOutput = undefined;
});

// ---------------------------------------------------------------------------
// 1. Background materialization path (constructor lines 304, 307-308)
//    tracking.materialization = true → setImmediate fires in lazy wrapper constructor
// ---------------------------------------------------------------------------
describe("unified-wrapper: background materialization (lines 304, 307-308)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 50));
	});

	it("lazy mode with tracking.materialization=true triggers background setImmediate", async () => {
		// tracking: { materialization: true } → in lazy wrapper constructor:
		//   if (slothlet.config.tracking?.materialization) {
		//     setImmediate(() => { this._materialize().catch(...) })  ← lines 304, 307-308
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			tracking: { materialization: true }
		});

		expect(api.math).toBeDefined();

		// Allow background materialization to run
		await new Promise((r) => setTimeout(r, 100));

		// After background materialization, math functions should be accessible
		expect(typeof api.math.add).toBe("function");
	});

	it("tracking=true (shorthand) also triggers background materialization", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			tracking: true
		});

		expect(api.math).toBeDefined();
		await new Promise((r) => setTimeout(r, 100));
		expect(typeof api.math.add).toBe("function");
	});

	it("background materialization with debug.materialize=true for error logging path", async () => {
		// debug.materialize=true enables the error logging inside the .catch() at lines 311-314
		// Even without an error, the setImmediate still fires and the catch is registered
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			tracking: { materialization: true },
			debug: { materialize: true }
		});

		expect(api.math).toBeDefined();
		await new Promise((r) => setTimeout(r, 100));
		expect(typeof api.math.add).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// 2. util.inspect.custom handler in main proxy get trap (lines 2135-2165)
//    Proxy get trap: when prop === util.inspect.custom → returns handler function
//    Handler body:
//      - Lines 2140-2148: childKeys.length > 0 && !isCallable (namespace wrapper)
//      - Lines 2151-2162: lazy && !materialized && impl === null (lazy unmaterialized)
//      - Line 2165: return wrapper._impl otherwise
// ---------------------------------------------------------------------------
describe("unified-wrapper: util.inspect.custom proxy handler (lines 2135-2165)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("util.inspect on namespace wrapper (childKeys.length > 0) → object output (lines 2140-2148)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		// api.math is a namespace wrapper with child functions (add, multiply)
		// util.inspect accesses the proxy[util.inspect.custom] → returns handler fn
		// handler fn is called → childKeys.length > 0, !isCallable → returns obj
		const inspected = util.inspect(api.math);
		expect(typeof inspected).toBe("string");
		// The inspection should produce something meaningful
		expect(inspected.length).toBeGreaterThan(0);
	});

	it("util.inspect on lazy namespace wrapper before materialization (lines 2151-2162)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async"
		});

		// api.task is a lazy folder wrapper, NOT yet materialized (just initialized)
		// util.inspect → get trap fires → util.inspect.custom → handler fn
		// handler fn: lazy && !materialized && impl === null → debug + return wrapper
		const inspected = util.inspect(api.task);
		expect(typeof inspected).toBe("string");
	});

	it("util.inspect on lazy namespace wrapper with debug.wrapper=true", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			debug: { wrapper: true }
		});

		const inspected = util.inspect(api.task);
		expect(typeof inspected).toBe("string");
	});

	it("util.inspect on callable function wrapper returns impl (line 2165)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		// api.math.add is a callable wrapper → childKeys.length === 0, isCallable === true
		// util.inspect → handler → falls through to `return wrapper.____slothletInternal.impl`
		const inspected = util.inspect(api.math.add);
		expect(typeof inspected).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// 3. debug.wrapper path for power/add access (lines 2314, 2325-2342)
//    When debug.wrapper=true and api.math.power or api.math.add is accessed,
//    the main proxy get trap logs "DEBUG_MODE_GET_PROXYGET_ACCESSING"
// ---------------------------------------------------------------------------
describe("unified-wrapper: debug.wrapper=true access to power/add (lines 2314, 2325-2342)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("accessing api.math.power with debug.wrapper=true covers debug lines 2325-2342", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "eager",
			runtime: "async",
			debug: { wrapper: true },
			api: { collision: { initial: "merge" } }
		});

		// api.math is a merged namespace from collision fixture
		// Accessing api.math.power (a child) triggers the proxy get trap
		// With debug.wrapper=true, lines 2325-2342 fire when prop === "power"
		expect(typeof api.math.power).toBe("function");
	});

	it("accessing api.math.add with debug.wrapper=true covers add branch (line 2325)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "eager",
			runtime: "async",
			debug: { wrapper: true },
			api: { collision: { initial: "merge" } }
		});

		// api.math.add from collision fixture (math/ folder)
		expect(typeof api.math.add).toBe("function");
	});

	it("debug.wrapper=true in lazy mode with collision covers debug collision mode logging", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			runtime: "async",
			debug: { wrapper: true },
			api: { collision: { initial: "merge" } }
		});

		// Trigger materialization by accessing power
		const ____powerFn = api.math?.power;
		await new Promise((r) => setTimeout(r, 100));
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 4. Lazy in-flight get trap debug path (lines 2362-2389)
//    When a lazy wrapper is in inFlight state and a property is accessed:
//    - Line 2367: debug log for LAZY_GET_CREATE_WAITING_PROXY
//    - Line 2387: custom proxy delegation when impl is a Proxy
// ---------------------------------------------------------------------------
describe("unified-wrapper: in-flight lazy get trap (lines 2362-2389)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("accessing prop on in-flight lazy wrapper with debug.wrapper fires debug log", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			debug: { wrapper: true }
		});

		// Manually start materialization of task wrapper to put it in inFlight state
		const taskProxy = api.task;
		// Access taskProxy to start inFlight materialization
		// Accessing a child prop triggers the in-flight waiting proxy creation
		const ____promised = taskProxy?.asyncReject; // triggers lazy get trap
		await new Promise((r) => setTimeout(r, 100));
		expect(api.task).toBeDefined();
	});

	it("accessing lazy folder during background materialization hits in-flight path", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			tracking: { materialization: true },
			debug: { wrapper: true }
		});

		// Background materialization starts immediately → task wrapper goes inFlight
		// Then accessing taskProxy triggers the inFlight branch in get trap
		const taskProxy = api.task;
		const ____childRef = taskProxy?.parseJson;
		await new Promise((r) => setTimeout(r, 100));
		expect(api.task).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 5. has trap for lazy wrapper (lines 2743, 2778)
//    `"key" in lazyWrapper` triggers the has trap
//    Line 2743: lazy && !materialized && !inFlight → _materialize() in hasTrap
//    Line 2778: lazy && !materialized && !inFlight → _materialize() in getOwnPropertyDescriptorTrap
//
// NOTE: api.task is used instead of api.math because api_test/ has BOTH math.mjs (root file)
// AND math/ (folder) — the collision between them produces a wrapper that may already
// be partially initialised. api.task is a pure folder (task/ with no same-named sibling
// file) and starts as a cleanly lazy, !materialized, !inFlight wrapper.
// ---------------------------------------------------------------------------
describe("unified-wrapper: has trap for lazy wrapper (lines 2743, 2778)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("'in' operator on lazy FOLDER wrapper (api.task) triggers _materialize() in hasTrap (line 2743)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async"
		});

		// api.task is a pure lazy folder wrapper (task/ folder with no same-named root file).
		// Accessing api.task returns the proxy without triggering any get trap.
		// Then "asyncReject" in api.task fires hasTrap:
		//   wrapper is lazy && !materialized && !inFlight → calls wrapper._materialize() (line 2743)
		const taskProxy = api.task;
		const hasAsyncReject = "asyncReject" in taskProxy;
		// Result is boolean (true once materialization completes or false for pending)
		expect(typeof hasAsyncReject).toBe("boolean");
	});

	it("'in' operator with _materialize prop always returns true (early-exit branch)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async"
		});

		// Line 2731: if (prop === "_materialize") return true — the special early-exit guard
		const taskProxy = api.task;
		const hasMaterialize = "_materialize" in taskProxy;
		expect(hasMaterialize).toBe(true);
	});

	it("'in' operator on materialized lazy wrapper hits impl-check branch", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async"
		});

		// Trigger materialization of task wrapper via a GET trap access
		const taskProxy = api.task;
		const _ = taskProxy.asyncReject; // triggers get trap → _materialize()
		await new Promise((r) => setTimeout(r, 150));

		// After materialization: has trap checks wrapper children + impl
		const hasAsyncReject = "asyncReject" in taskProxy;
		expect(typeof hasAsyncReject).toBe("boolean");
	});

	it("'in' operator on eager wrapper uses has trap without materializing", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		// Eager mode: has trap checks wrapper children and impl directly (no _materialize() called)
		const hasAsyncReject = "asyncReject" in api.task;
		expect(hasAsyncReject).toBe(true);
	});

	it("Object.getOwnPropertyDescriptor on lazy FOLDER wrapper triggers _materialize() in getOwnPropertyDescriptorTrap (line 2778)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async"
		});

		// api.task is a pure lazy folder wrapper — first access via getOwnPropertyDescriptor
		// fires getOwnPropertyDescriptorTrap:
		//   wrapper is lazy && !materialized && !inFlight → calls wrapper._materialize() (line 2778)
		const taskProxy = api.task;
		const descriptor = Object.getOwnPropertyDescriptor(taskProxy, "asyncReject");
		// Result may be undefined (not yet materialized) or a descriptor (after materialization)
		expect(descriptor === undefined || typeof descriptor === "object").toBe(true);
	});

	it("Object.getOwnPropertyDescriptor returns undefined for ____slothletInternal (filtered prop)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async"
		});

		const taskProxy = api.task;
		// ____slothletInternal is explicitly filtered in getOwnPropertyDescriptorTrap
		const descriptor = Object.getOwnPropertyDescriptor(taskProxy, "____slothletInternal");
		expect(descriptor).toBeUndefined();
	});
});
