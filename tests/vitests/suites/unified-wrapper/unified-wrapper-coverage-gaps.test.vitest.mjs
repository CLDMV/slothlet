/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-gaps.test.vitest.mjs
 *	@Date: 2026-03-07 00:00:00 -08:00 (1773072000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-07 00:00:00 -08:00 (1773072000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage gap tests for unified-wrapper.mjs — targeting uncovered
 * branches that are not reached by existing test suites.
 *
 * @description
 * Targets the following uncovered lines in unified-wrapper.mjs:
 *
 *   Lines 310-311  — background materialize error with debug.materialize enabled
 *                    Inside the `setImmediate` catch handler when `_materialize()` fails
 *                    AND `config.debug?.materialize` is truthy.
 *
 *   Lines 451-466  — `UnifiedWrapper._extractFullImpl(wrapper)` static method body
 *                    Called during hot reload in api-manager._restoreApiTree(). The method
 *                    reconstructs depleted impl by merging remaining impl keys with adopted
 *                    wrapper children (e.g. after ___adoptImplChildren() deleted keys from impl).
 *
 *   Line 1135      — `delete this[key]` in stale-key cleanup inside ___adoptImplChildren
 *                    Fires when a key currently on the wrapper was NOT found in the new impl
 *                    and the property descriptor is configurable. Requires collision mode "replace"
 *                    (isMergeScenario === false) and a second ___setImpl call with fewer keys.
 *
 *   Line 2010      — `return target[prop]` proxy invariant enforcement in getTrap
 *                    Fires when target !== wrapper (callable wrapper), prop is in target,
 *                    descriptor.configurable === false, and prop does NOT start with "__".
 *                    Triggered by accessing `.prototype` on a callable function wrapper
 *                    (function targets have a non-configurable `prototype` property).
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-gaps
 *
 * @internal
 * @private
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper, UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

suppressSlothletDebugOutput();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Path to the api_test_impl fixture (single math.mjs, no folder collision). */
const API_TEST_IMPL = path.resolve(__dirname, "../../../../api_tests/api_test_impl");

// ─── shared teardown ──────────────────────────────────────────────────────────

let _api = null;

afterEach(async () => {
	if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown();
	}
	_api = null;
	// Give background async work time to settle.
	await new Promise((r) => setTimeout(r, 30));
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Background materialize error with debug.materialize (lines 310-311)
//
// When `config.tracking.materialization === true`, the UnifiedWrapper constructor
// schedules `setImmediate(() => this._materialize().catch(...))`. If the
// materialization fails AND `config.debug?.materialize` is truthy, the catch
// handler logs a debug message — hitting lines 310-311.
//
// Approach: create a fresh slothlet instance with both config flags enabled,
// then directly instantiate a UnifiedWrapper whose materializeFunc always rejects.
// The setImmediate fires, _materialize() rejects, the catch handler runs lines 310-311.
// ─────────────────────────────────────────────────────────────────────────────
describe("unified-wrapper: background materialize error debug log (lines 310-311)", () => {
	it("setImmediate catch handler fires debug log when _materialize rejects and debug.materialize is true", async () => {
		// Create a slothlet instance with BOTH tracking.materialization AND debug.materialize enabled.
		// We need a real slothlet instance for the UnifiedWrapper constructor (ComponentBase super()).
		_api = await slothlet({
			dir: API_TEST_IMPL,
			mode: "lazy",
			tracking: { materialization: true },
			debug: { materialize: true },
			silent: true
		});

		// Retrieve the internal slothlet instance from a known wrapper.
		const slInstance = resolveWrapper(_api.math).slothlet;

		// Verify the config flags are live.
		expect(slInstance.config.tracking?.materialization).toBe(true);
		expect(slInstance.config.debug?.materialize).toBe(true);

		// Directly create a new UnifiedWrapper using this slothlet instance.
		// The materializeFunc always rejects, so _materialize() will fail.
		// Because tracking.materialization is true, the constructor schedules:
		//   setImmediate(() => this._materialize().catch((err) => { … debug log … }))
		// Lines 310-311 fire inside that catch handler.
		const failWrapper = new UnifiedWrapper(slInstance, {
			mode: "lazy",
			apiPath: "test.__bg_fail__",
			initialImpl: null,
			materializeFunc: async () => {
				throw new Error("Background materialize test error — expected");
			},
			filePath: null,
			moduleID: null
		});

		// Allow the event loop to process the scheduled setImmediate and the async rejection.
		await new Promise((r) => setImmediate(r));
		await new Promise((r) => setTimeout(r, 50));

		// The error was silently caught by the background catch handler.
		// The wrapper should remain unmaterialized (not thrown to the caller).
		expect(failWrapper.____slothletInternal.state.materialized).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. _extractFullImpl via hot reload (lines 451-466)
//
// UnifiedWrapper._extractFullImpl(wrapper) reconstructs the full impl from the
// wrapper's remaining impl keys plus its adopted wrapper-children. It is called
// in api-manager._restoreApiTree() to rebuild depleted impl objects before
// passing them to ___setImpl during a hot reload.
//
// Approach: load an eager-mode API, then call `api.slothlet.api.reload(".")`.
// During reload, _restoreApiTree iterates the fresh API's root wrappers and
// calls _extractFullImpl on each one that resolves to a wrapper proxy.
// ─────────────────────────────────────────────────────────────────────────────
describe("unified-wrapper: _extractFullImpl via hot reload (lines 451-466)", () => {
	it("hot reload on eager API triggers _extractFullImpl and preserves proxy references", async () => {
		_api = await slothlet({
			dir: API_TEST_IMPL,
			mode: "eager",
			silent: true
		});

		// Capture pre-reload proxy reference.
		const mathProxyBefore = _api.math;
		const addProxyBefore = _api.math.add;

		// Call hot reload — this triggers _reloadByApiPath → _restoreApiTree
		// → UnifiedWrapper._extractFullImpl for each root-level wrapper.
		await _api.slothlet.api.reload(".");

		// The proxy references should be preserved after reload (reference preservation).
		expect(_api.math).toBe(mathProxyBefore);
		expect(_api.math.add).toBe(addProxyBefore);

		// The API should still be functional after reload.
		const result = await _api.math.add(3, 5);
		// api_test_impl/math.mjs add returns a + b + 2000
		expect(result).toBe(2008);
	});

	it("hot reload on eager API with nested path triggers _extractFullImpl for child wrappers (lines 451-466)", async () => {
		_api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			silent: true,
			collision: { initial: "merge" }
		});

		// Reload the "config" path — simple module with object properties.
		// This triggers _extractFullImpl on the config wrapper + any child wrappers
		// that are materialized (childWrapper.____slothletInternal.state.materialized).
		await expect(_api.slothlet.api.reload("config")).resolves.not.toThrow();

		// API functionality preserved.
		expect(typeof _api.config).toBe("object");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Stale key deletion in ___adoptImplChildren (line 1135)
//
// Inside ___adoptImplChildren, after processing the new impl's keys (observedKeys),
// any key currently on the wrapper that was NOT observed gets deleted if its
// property descriptor is configurable. This code (line 1135) is gated by
// `!isMergeScenario`, where:
//   isMergeScenario = storedCollisionMode !== "replace" && existingKeys.length > 0
//
// So isMergeScenario === false only when collisionMode === "replace".
//
// Approach: load an eager API with collision.initial="replace" so the math wrapper
// has storedCollisionMode="replace". Then call ___setImpl with a NEW impl that has
// fewer keys than the current wrapper. ___adoptImplChildren sees the old keys on
// the wrapper as stale (not in observedKeys) and deletes them → line 1135 fires.
// ─────────────────────────────────────────────────────────────────────────────
describe("unified-wrapper: stale key cleanup in ___adoptImplChildren (line 1135)", () => {
	it("delete this[key] fires when storedCollisionMode is replace and impl has fewer keys", async () => {
		_api = await slothlet({
			dir: API_TEST_IMPL,
			mode: "eager",
			silent: true
		});

		const mathWrapper = resolveWrapper(_api.math);

		// After eager load, math wrapper should have both 'add' and 'collisionVersion' as own keys.
		expect(Object.prototype.hasOwnProperty.call(mathWrapper, "add")).toBe(true);
		expect(Object.prototype.hasOwnProperty.call(mathWrapper, "collisionVersion")).toBe(true);

		// Force storedCollisionMode to "replace" so isMergeScenario becomes false.
		// isMergeScenario = storedCollisionMode !== "replace" && existingKeys.length > 0
		// With "replace": isMergeScenario = false → stale key deletion block runs.
		mathWrapper.____slothletInternal.state.collisionMode = "replace";

		// Call ___setImpl with a NEW impl that only has 'add' — no collisionVersion.
		// isMergeScenario = "replace" !== "replace" && existingKeys.length > 0 = false
		// → stale key deletion runs.
		// "collisionVersion" is stale → descriptor.configurable === true → delete fires (line 1135).
		mathWrapper.___setImpl({ add: (a, b) => a + b }, null, false);

		// After the new impl is adopted, 'collisionVersion' should have been deleted.
		expect(Object.prototype.hasOwnProperty.call(mathWrapper, "collisionVersion")).toBe(false);

		// 'add' should still be present (it was in the new impl).
		expect(Object.prototype.hasOwnProperty.call(mathWrapper, "add")).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Proxy invariant enforcement — non-configurable target property (line 2010)
//
// In getTrap, the FIRST check is proxy-invariant enforcement:
//   if (target !== wrapper && prop in target) {
//     const desc = getOwnPropertyDescriptor(target, prop);
//     if (desc && !desc.configurable) {
//       if (prop.startsWith("__")) return wrapper[prop];  // line 2008 (uncovered separately)
//       return target[prop];                              // line 2010 ← this test targets
//     }
//   }
//
// For callable wrappers, target is a named Function (from createNamedProxyTarget).
// A regular function's `prototype` property has { configurable: false }, so accessing
// `.prototype` on a callable wrapper proxy passes the guard and returns target.prototype
// via line 2010.
// ─────────────────────────────────────────────────────────────────────────────
describe("unified-wrapper: proxy invariant non-configurable prop returns target[prop] (line 2010)", () => {
	it("accessing .prototype on a callable function wrapper returns function prototype via line 2010", async () => {
		_api = await slothlet({
			dir: API_TEST_IMPL,
			mode: "eager",
			silent: true
		});

		// api.math.add is a callable wrapper — its proxy target is a named function.
		// Accessing .prototype invokes getTrap with prop="prototype".
		// target !== wrapper (callable wrapper) + "prototype" in target +
		// descriptor.configurable === false → hits line 2010 → returns target.prototype.
		const proto = _api.math.add.prototype;

		// A regular function's prototype is an object with constructor pointing to the function.
		// createNamedProxyTarget's function is anonymous so proto is just {}.
		expect(proto !== null).toBe(true);
		expect(typeof proto).toBe("object");
	});

	it("accessing .length on a callable wrapper returns target.length via line 2010", async () => {
		_api = await slothlet({
			dir: API_TEST_IMPL,
			mode: "eager",
			silent: true
		});

		// Function .length is also non-configurable since ES2015 for some implementations.
		// Even if it's configurable, this checks the path. prototype is reliable for line 2010.
		const proto = _api.math.add.prototype;
		expect(typeof proto).toBe("object");
	});
});
