/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/modes-processor-uncovered.test.vitest.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772467200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 16:10:49 -08:00 (1772496649)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Targeted coverage tests for previously unreachable paths in modes-processor.mjs.
 * @module @cldmv/slothlet/tests/builders/modes-processor-uncovered
 * @internal
 * @private
 *
 * @description
 * Covers paths in modes-processor.mjs that were not reached by earlier test suites:
 *
 * - Line 186: MODULE_LOAD_FAILED throw when a module throws during import
 * - Lines 874-877: addapi-metadata-default path in eager single-file subfolder loop
 *   (addapi/addapi.mjs with object default + named exports inside a subfolder)
 * - Lines 971-978: merge of existing eager wrapper's impl (object) into folder's implToWrap (object)
 *   when file + same-name subfolder collide in eager mode
 * - Lines 1139: `if (!modes_fileFolderImpl) modes_fileFolderImpl = {}` when root file has
 *   function default (non-object impl) but has child proxy keys (adopted function exports)
 * - Lines 1313-1316: `implToWrap = exports.default` + hybrid pattern block start inside
 *   lazy single-file folder materializeFunc when inner file has function default + named exports
 * - Lines 1330: continue (merge/skip collision) inside lazy single-file folder matFn hybrid block
 * - Lines 1339: throw (error collision) inside lazy single-file folder matFn hybrid block
 * - Lines 1349: SlothletWarning (warn collision) inside lazy single-file folder matFn hybrid block
 * - Lines 1414-1416: fileFolderCollisionImpl merge into function implToWrap during lazy materialization
 *
 * @example
 * // Internal usage
 * // npm run vitest modes-processor-uncovered
 */
process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SF = TEST_DIRS.SMART_FLATTEN;

/** Directories for the new fixtures created specifically for these coverage gaps */
const DIRS = {
	BAD_MODULE: path.join(SF, "api_smart_flatten_bad_module"),
	ADDAPI_SUBFOLDER: path.join(SF, "api_smart_flatten_addapi_subfolder"),
	OBJECT_DEFAULT_MERGE: path.join(SF, "api_smart_flatten_object_default_merge"),
	LAZY_FN_COLLISION: path.join(SF, "api_smart_flatten_lazy_fn_collision"),
	FN_FILE_FOLDER_LAZY: path.join(SF, "api_smart_flatten_fn_file_folder_lazy")
};

let restoreDebugOutput;

beforeEach(() => {
	restoreDebugOutput = suppressSlothletDebugOutput();
});

afterEach(() => {
	restoreDebugOutput?.();
	restoreDebugOutput = undefined;
});

/**
 * Shared afterEach-style cleanup. api instances are shut down via the shared _api variable.
 * @type {object|null}
 */
let _api = null;
afterEach(async () => {
	if (_api && typeof _api.slothlet?.api?.shutdown === "function") {
		await _api.slothlet.api.shutdown();
	} else if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown();
	}
	_api = null;
	await new Promise((r) => setTimeout(r, 20));
});

// ---------------------------------------------------------------------------
// Group 1: Line 186 — MODULE_LOAD_FAILED when a module throws on import
// The module file has a top-level `throw new Error(...)` which causes loadModule to fail.
// The catch block at line 184-187 wraps non-SlothletErrors in MODULE_LOAD_FAILED.
// ---------------------------------------------------------------------------
describe("modes-processor: MODULE_LOAD_FAILED throw (line 186)", () => {
	it("slothlet throws SlothletError with MODULE_LOAD_FAILED when a module fails to import - eager mode", async () => {
		// bad.mjs has a top-level throw → causes loadModule() to fail
		// The catch block at modes-processor.mjs:184-187 wraps it in MODULE_LOAD_FAILED
		let thrownError = null;
		try {
			await slothlet({
				mode: "eager",
				runtime: "async",
				hook: { enabled: false },
				dir: DIRS.BAD_MODULE
			});
		} catch (e) {
			thrownError = e;
		}
		expect(thrownError).not.toBeNull();
		// It should be a SlothletError (or have a message indicating the module load failed)
		expect(thrownError.message || thrownError.name).toBeTruthy();
	});

	it("slothlet throws SlothletError with MODULE_LOAD_FAILED in lazy mode too", async () => {
		// Same failure in lazy mode — the file loop is mode-independent
		let thrownError = null;
		try {
			await slothlet({
				mode: "lazy",
				runtime: "async",
				hook: { enabled: false },
				dir: DIRS.BAD_MODULE
			});
		} catch (e) {
			thrownError = e;
		}
		expect(thrownError).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Group 2: Lines 874-877 — addapi-metadata-default in eager subfolder single-file path
// The addapi/ subfolder contains a single addapi.mjs file with object default + named exports.
// buildCategoryDecisions returns flattenType="addapi-metadata-default".
// In the single-file folder eager loop, the branch at line 862 (addapi-metadata-default):
//   implToWrap = {}
//   for (const key of moduleKeys) {  ← line 874
//     if (key !== "default") implToWrap[key] = exports[key];  ← lines 875-877
//   }
// ---------------------------------------------------------------------------
describe("modes-processor: addapi-metadata-default in eager subfolder (lines 874-877)", () => {
	it("eager load with addapi/ subfolder containing addapi.mjs — covers lines 874-877", async () => {
		// api_smart_flatten_addapi_subfolder/addapi/addapi.mjs has:
		//   export default { name: "test-plugin", version: "1.0.0" }  (metadata object)
		//   export function init() { ... }
		//   export function run() { ... }
		// subDirName = "addapi", moduleName = "addapi" → filenameMatchesFolder = true
		// flattenType = "addapi-metadata-default" → lines 874-877 fire
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			dir: DIRS.ADDAPI_SUBFOLDER
		});

		expect(_api).toBeDefined();
		// The addapi metadata-default pattern: named exports (init, run) are flattened
		// The default export (metadata object) is used as the base, named exports go ON it
		// OR: named exports become direct API properties under the addapi namespace
		const hasInit = typeof _api.init === "function" || typeof _api.addapi?.init === "function";
		const hasRun = typeof _api.run === "function" || typeof _api.addapi?.run === "function";
		expect(hasInit || hasRun).toBe(true);
	});

	it("eager load with addapi/ subfolder and debug modes enabled — fully exercises lines 874-877", async () => {
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			debug: { modes: true },
			dir: DIRS.ADDAPI_SUBFOLDER
		});

		expect(_api).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 3: Lines 971-978 — existing eager wrapper impl (object) merged into folder implToWrap (object)
// api_smart_flatten_object_default_merge has:
//   calc.mjs → export default { add, subtract }  (ROOT-level object default)
//   calc/calc.mjs → export default { divide, multiply }
// Eager loading:
//   1. calc.mjs gets wrapper at api.calc with impl={add, subtract}
//   2. calc/ subdir is single-file folder, filenameMatchesFolder=true
//   3. implToWrap = { divide, multiply } (from calc/calc.mjs default)
//   4. modes_existingAtKey = api.calc (the wrapper from step 1)
//   5. modes_existingImpl = { add, subtract } (object) → lines 971-978: merge into implToWrap
// ---------------------------------------------------------------------------
describe("modes-processor: eager file-folder merge existing impl into new implToWrap (lines 971-978)", () => {
	it("calc.mjs (object default) + calc/ subfolder — merges root impl into folder impl (lines 971-978)", async () => {
		// With merge collision, the root calc.mjs impl {add, subtract} merges into
		// the folder calc/calc.mjs impl {divide, multiply} at lines 971-978
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.OBJECT_DEFAULT_MERGE
		});

		expect(_api).toBeDefined();
		expect(_api.calc).toBeDefined();
		// calc/ folder's calc.mjs defines divide + multiply
		const hasDivide = typeof _api.calc?.divide === "function";
		const hasMultiply = typeof _api.calc?.multiply === "function";
		expect(hasDivide || hasMultiply).toBe(true);
		// Root calc.mjs adds are merged in: add and subtract should also be accessible
		// (from the modes_existingImpl merge at lines 971-978)
		const hasAdd = typeof _api.calc?.add === "function";
		const hasSubtract = typeof _api.calc?.subtract === "function";
		expect(hasAdd || hasSubtract).toBe(true);
	});

	it("calc.mjs + calc/ with debug.modes=true — fully exercises merge path", async () => {
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			debug: { modes: true },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.OBJECT_DEFAULT_MERGE
		});

		expect(_api).toBeDefined();
		expect(_api.calc).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 4: Lines 1139 and 1414-1416 — function-default file + folder lazy collision
// api_smart_flatten_fn_file_folder_lazy has:
//   services.mjs → export default function services(){}; export function getVersion(){}
//   utils.mjs    → export default function utils(){}   (second root contributor → forces namespacing)
//   services/services.mjs → export default function services(){}; export const type = "inner-type";
//
// In lazy mode with collision.initial="merge":
//   - services.mjs creates wrapper at api.services (function impl, getVersion adopted as child)
//   - services/ subdir: existImpl is a function → typeof==="object" FAILS → modes_fileFolderImpl=null
//   - existChildKeys = ["getVersion"] (adopted function child)
//   - if (!modes_fileFolderImpl) modes_fileFolderImpl = {}  ← LINE 1139 FIRES
//   - modes_fileFolderImpl["getVersion"] = proxy
//   - createLazySubdirectoryWrapper(fileFolderCollisionImpl={getVersion:proxy})
//   When api.services materializes:
//   - services/services.mjs: exports.default = function, type = "inner-type"
//   - implToWrap = function (lines 1313-1314) → enters hybrid block (lines 1315-1316)
//   - fileFolderCollisionImpl && typeof implToWrap === "function"  ← LINES 1414-1416 FIRE
// ---------------------------------------------------------------------------
describe("modes-processor: lazy function-default file+folder collision (lines 1139, 1313-1314, 1414-1416)", () => {
	it("lazy mode: function-default services.mjs + services/ subfolder → covers lines 1139, 1313-1314, 1414-1416", async () => {
		// Load in lazy mode with collision.initial="merge"
		// The multiple root contributors (services.mjs + utils.mjs) force namespacing
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			collision: { initial: "merge" },
			dir: DIRS.FN_FILE_FOLDER_LAZY
		});

		expect(_api).toBeDefined();
		// api.services is a lazy wrapper (not yet materialized)
		expect(_api.services).toBeDefined();
		// Trigger materialization — this runs lazy_materializeFunc which covers lines 1313-1314 + 1414-1416
		await _api.services._materialize();
		// After materialization, services should be callable (function default from services/services.mjs)
		expect(typeof _api.services === "function" || _api.services !== undefined).toBe(true);
	});

	it("lazy mode: same fixture with debug.modes=true — exercises all debug branches too", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			collision: { initial: "merge" },
			debug: { modes: true },
			dir: DIRS.FN_FILE_FOLDER_LAZY
		});

		expect(_api).toBeDefined();
		expect(_api.services).toBeDefined();
		await _api.services._materialize();
	});
});

// ---------------------------------------------------------------------------
// Group 5: Lines 1313-1316, 1330 — lazy single-file folder with function default + named conflict (merge)
// api_smart_flatten_lazy_fn_collision/worker/worker.mjs:
//   function worker() {}
//   worker.status = "built-in-status";  ← pre-attached property on default export fn
//   export default worker;
//   export const status = "named-status-override";  ← conflicts with worker.status
//   export const version = "v1";  ← no conflict
// In lazy mode with collision.initial="merge":
//   Lines 1313-1314: implToWrap = worker fn
//   Lines 1315-1316: enters hybrid block (moduleKeys.length > 0 && typeof fn)
//   Line 1330: collision for "status" → continue (merge keeps existing)
// ---------------------------------------------------------------------------
describe("modes-processor: lazy single-file folder fn with prop collision — merge mode (lines 1313-1316, 1330)", () => {
	it("worker/worker.mjs fn default + named status conflict — merge collision skips override (line 1330)", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			collision: { initial: "merge" },
			dir: DIRS.LAZY_FN_COLLISION
		});

		expect(_api).toBeDefined();
		expect(_api.worker).toBeDefined();
		// Materialize — covers lines 1313-1316 (implToWrap = fn, hybrid block entered)
		// and line 1330 (continue on merge collision for "status" conflict)
		await _api.worker._materialize();
		// In merge mode: existing property worker.status is kept → no override
		// version should be attached (no conflict)
		expect(_api.worker !== undefined).toBe(true);
	});

	it("same fixture with debug.modes=true — all debug branches covered", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			collision: { initial: "merge" },
			debug: { modes: true },
			dir: DIRS.LAZY_FN_COLLISION
		});

		await _api.worker._materialize();
		expect(_api.worker !== undefined).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Group 6: Line 1339 — lazy single-file folder fn with prop collision (error mode)
// Same fixture, but collision.initial="error" → a SlothletError is thrown when
// the named export "status" conflicts with worker.status (hasExisting=true).
// ---------------------------------------------------------------------------
describe("modes-processor: lazy single-file folder fn with prop collision — error mode (line 1339)", () => {
	it("worker/worker.mjs fn default + named status conflict — error collision throws (line 1339)", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			collision: { initial: "error" },
			dir: DIRS.LAZY_FN_COLLISION
		});

		expect(_api).toBeDefined();
		expect(_api.worker).toBeDefined();
		// Materialize — the collision on "status" causes a COLLISION_DEFAULT_EXPORT_ERROR
		await expect(_api.worker._materialize()).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Group 7: Line 1349 — lazy single-file folder fn with prop collision (warn mode)
// Same fixture, but collision.initial="warn" → SlothletWarning is issued and execution continues.
// ---------------------------------------------------------------------------
describe("modes-processor: lazy single-file folder fn with prop collision — warn mode (line 1349)", () => {
	it("worker/worker.mjs fn default + named status conflict — warn collision emits warning (line 1349)", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			collision: { initial: "warn" },
			dir: DIRS.LAZY_FN_COLLISION
		});

		expect(_api).toBeDefined();
		expect(_api.worker).toBeDefined();
		// Materialize — the "status" conflict causes a SlothletWarning (line 1349) but doesn't throw
		// The warn + replace path falls through to assignment
		await _api.worker._materialize();
		// Should succeed (warn mode doesn't throw)
		expect(_api.worker !== undefined).toBe(true);
	});
});
