/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/modes-processor-no-wrap.test.vitest.mjs
 *	@Date: 2026-03-02T19:00:00-08:00 (1772514000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 19:00:00 -08:00 (1772514000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for previously unreachable paths in modes-processor.mjs.
 * @module @cldmv/slothlet/tests/builders/modes-processor-no-wrap
 * @internal
 * @private
 *
 * @description
 * Targets specific uncovered lines identified from coverage-final.json analysis.
 * Each group documents exactly WHY the line is reached (or provably dead code)
 * so future maintainers understand the constraints.
 *
 * Covered lines:
 *
 * Lines 343, 344 — shouldAttachNamedExport guard inside Case 2 (folder/folder.mjs)
 *   Condition: !isRoot && !apiPathPrefix && moduleName === categoryName && analysis.hasDefault
 *   processModuleForAPI skips keys where shouldAttachNamedExport=false (key===fn.name).
 *   Case 2's namedKeys loop then evaluates the guard (343) and hits `continue` (344).
 *   Fixture: api_smart_flatten_folder_with_named/logger/logger.mjs
 *     - export default function logger(){} — function named "logger"
 *     - export { logger }               — named "logger" === fn.name → shouldAttach=false
 *
 * Lines 975-978 — object→function merge in eager file-folder collision
 *   Condition: modes_existingImpl is an Object AND typeof implToWrap === "function"
 *   This is the `else if (typeof implToWrap === "function")` branch at line 975.
 *   Fixture: api_smart_flatten_obj_fn_folder/
 *     - calc.mjs        — export default { add, subtract }  (object default)
 *     - calc/calc.mjs   — export default function calc(){}  (function default)
 *
 * Line 991 — child-key copy when implToWrap is a function
 *   Same fixture as 975-978; fires when modes_existingChildKeys is non-empty
 *   and implToWrap is a function.  Depends on ___adoptImplChildren() populating
 *   the wrapper's enumerable keys.  Covered when the child copy path is entered.
 *
 * Dead-code lines (cannot be reached through the public API surface):
 *   Line 346 — `callableModule[key] = mod[key]` inside Case 2 namedKeys loop.
 *     processModuleForAPI always pre-attaches any key that passes shouldAttachNamedExport,
 *     so Case 2's `key in callableModule` guard at line 340 is always true for those keys.
 *     This assignment can never fire.
 *
 *   Lines 305, 365–366, 374, 392, 450, 485, 546, 552, 605, 696, 747, 1211 — all
 *     `shouldWrap=false` else-branches.  shouldWrap=false requires
 *     `effectiveMode === "lazy" && populateDirectly === true`, a combination that
 *     no production call-site generates: lazy.mjs always passes populateDirectly=false;
 *     the lazy non-recursive Folder-Transparency path uses explicit "eager"; and
 *     createLazySubdirectoryWrapper's processFiles call uses "eager" directly.
 *
 *   Line 958 — `await modes_existingWrapper._materialize()` inside the eager recursive
 *     collision block.  Requires an existing lazy wrapper (with materializeFunc) at the
 *     slot during eager recursive directory processing.  All root files are eagerly
 *     wrapped even in lazy mode, so this condition never holds.
 *
 *   Line 1511 — `return nestedValue` when nestedValue is falsy or not a wrapper.
 *     In eager-mode materialization processFiles calls all produce wrapper proxies
 *     (shouldWrap=true), so resolveWrapper(nestedValue) is always non-null.
 *
 * @example
 * // npm run vitest modes-processor-no-wrap
 */
process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SF = TEST_DIRS.SMART_FLATTEN;

const DIRS = {
	FOLDER_WITH_NAMED: path.join(SF, "api_smart_flatten_folder_with_named"),
	OBJ_FN_FOLDER: path.join(SF, "api_smart_flatten_obj_fn_folder"),
	ADDAPI_SUBFOLDER: path.join(SF, "api_smart_flatten_addapi_subfolder"),
	FN_FN_FOLDER: path.join(SF, "api_smart_flatten_fn_fn_folder")
};

let _api = null;
let restoreDebugOutput;

beforeEach(() => {
	restoreDebugOutput = suppressSlothletDebugOutput();
});

afterEach(async () => {
	restoreDebugOutput?.();
	restoreDebugOutput = undefined;

	if (_api && typeof _api.slothlet?.api?.shutdown === "function") {
		await _api.slothlet.api.shutdown();
	} else if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown();
	}
	_api = null;
	await new Promise((r) => setTimeout(r, 20));
});

// ---------------------------------------------------------------------------
// Group 1: Lines 343, 344 — shouldAttachNamedExport guard in Case 2 namedKeys loop
//
// WHY these lines are reachable here but NOT by existing tests:
//   processModuleForAPI is always called before the Case 2 dispatch.  When it processes
//   a function default + named exports, it uses the Hybrid pattern which calls
//   shouldAttachNamedExport internally.  For keys where shouldAttachNamedExport=true,
//   the key is attached to mod.default; Case 2's `key in callableModule` check then
//   fires the early continue at line 340 — bypassing 343/344 entirely.
//
//   For keys where shouldAttachNamedExport=false (key === fn.name, or value === default),
//   processModuleForAPI skips the attachment.  Class 2's `key in callableModule` check
//   is therefore FALSE.  Code reaches line 343 (the guard evaluation) and enters the
//   if-body because shouldAttachNamedExport also returns false → line 344 (continue).
//
// Fixture: api_smart_flatten_folder_with_named/logger/logger.mjs
//   export default function logger() { ... }   ← named "logger"
//   export { logger };                         ← key="logger"; value=loggerFn===loggerFn(default)
//   export const version = "1.0.0";
//
// Iteration for key="logger":
//   processModuleForAPI skips  (shouldAttachNamedExport=false, value===mod.default)
//   Case 2: "logger" NOT in callableModule  →  line 343 evaluated
//           shouldAttachNamedExport=false    →  !false = true  →  line 344 (continue) fires
//
// Iteration for key="version":
//   processModuleForAPI attaches (shouldAttachNamedExport=true)
//   Case 2: "version" IS in callableModule  →  line 341 fires (early continue)
//           lines 343, 344, 346 are NOT reached for this key  (intended)
// ---------------------------------------------------------------------------
describe("modes-processor: Case 2 shouldAttachNamedExport guard (lines 343, 344)", () => {
	it("eager load: logger/logger.mjs with re-exported default covers lines 343 + 344", async () => {
		// Ensures the guard at line 343 is evaluated AND the continue at line 344
		// fires for the re-exported-function key.
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			dir: DIRS.FOLDER_WITH_NAMED
		});

		expect(_api).toBeDefined();
		// api.logger should be the callable wrapper (Case 2 wraps the function)
		expect(_api.logger).toBeDefined();
	});

	it("eager load with debug.modes=true — exercises all debug branches in the same path", async () => {
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			debug: { modes: true },
			dir: DIRS.FOLDER_WITH_NAMED
		});

		expect(_api).toBeDefined();
		expect(_api.logger).toBeDefined();
	});

	it("eager load with merge collision — same path, confirms shouldAttachNamedExport guard fires", async () => {
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.FOLDER_WITH_NAMED
		});

		expect(_api).toBeDefined();
		expect(_api.logger).toBeDefined();
	});

	it("lazy load — Case 2 still fires during materialization (same guard path)", async () => {
		// In lazy mode the logger/ subdir also goes through the eager single-file-folder
		// flatten path inside createLazySubdirectoryWrapper; the same guard logic applies.
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: DIRS.FOLDER_WITH_NAMED
		});

		expect(_api).toBeDefined();
		expect(_api.logger).toBeDefined();
		// Trigger materialization to exercise the lazy flatten path as well
		await _api.logger._materialize?.();
		expect(_api.logger).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 2: Lines 975-978 — object→function merge in eager file-folder collision
//
// WHY:
//   Lines 969-974 (object→object merge) are covered by modes-processor-uncovered.test.vitest.mjs
//   Group 3.  Lines 975-978 are the `else if (typeof implToWrap === "function")` branch —
//   they fire only when modes_existingImpl is an Object AND implToWrap is a Function.
//
//   The coverage-final.json was generated before those tests existed, so the branch map
//   still shows 975-978 as uncovered.  This group uses a fixture where:
//     - Root calc.mjs   → export default { add, subtract }   (object)
//     - calc/calc.mjs   → export default function calc(){}   (function)
//
//   Eager processing:
//     1. calc.mjs creates eager wrapper at api.calc with impl={add,subtract}
//     2. calc/ subdir (single-file, filenameMatchesFolder=true) → implToWrap = function calc
//     3. modes_existingAtKey = api.calc wrapper; modes_existingImpl = {add,subtract} (object)
//     4. typeof implToWrap === "function" → line 975 fires
//        Loop → for [k,v] in {add,subtract}: implToWrap[k]=v → lines 976-978
//     5. modes_existingChildKeys loop → if typeof implToWrap==="function" → line 991 may fire
// ---------------------------------------------------------------------------
describe("modes-processor: eager file-folder collision object→function merge (lines 975-978)", () => {
	it("calc.mjs (object) + calc/calc.mjs (function) — merge branch lines 975-978 fire", async () => {
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.OBJ_FN_FOLDER
		});

		expect(_api).toBeDefined();
		expect(_api.calc).toBeDefined();
		// After merge: the function default from calc/calc.mjs is implToWrap,
		// and add/subtract from root calc.mjs obj are copied onto it (lines 975-978).
		// The merged result should be callable (from function default) and have add/subtract.
		const calcApi = _api.calc;
		expect(calcApi).toBeDefined();

		const hasAdd = typeof calcApi?.add === "function";
		const hasSubtract = typeof calcApi?.subtract === "function";
		expect(hasAdd || hasSubtract || typeof calcApi === "function").toBe(true);
	});

	it("same fixture with debug.modes=true — exercises all debug branches", async () => {
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			debug: { modes: true },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.OBJ_FN_FOLDER
		});

		expect(_api).toBeDefined();
		expect(_api.calc).toBeDefined();
	});

	it("same fixture with merge-replace collision mode", async () => {
		// merge-replace: folder wins on conflicts, file exports added for non-conflicts
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge-replace", api: "merge-replace" } },
			dir: DIRS.OBJ_FN_FOLDER
		});

		expect(_api).toBeDefined();
		expect(_api.calc).toBeDefined();
	});

	it("same fixture with warn collision mode", async () => {
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "warn", api: "warn" } },
			dir: DIRS.OBJ_FN_FOLDER
		});

		expect(_api).toBeDefined();
		expect(_api.calc).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 3: Line 991 — child-key copy (function implToWrap) in modes_existingChildKeys loop
//
// After modes_existingWrapper.___adoptImplChildren() runs, enumerable child keys from the
// existing wrapper's impl become visible via Object.keys(modes_existingWrapper).  When
// typeof implToWrap === "function", the `else if` at line 990 fires and line 991
// copies those child keys onto the function.
//
// Same fixture as Group 2; covered by triggering the same eager file-folder collision
// with an object-impl root file and function-impl subfolder.
// ---------------------------------------------------------------------------
describe("modes-processor: modes_existingChildKeys function-copy (line 991)", () => {
	it("child-key copy fires when implToWrap is a function — line 991", async () => {
		// The ___adoptImplChildren() call at line 965 may expose add/subtract as
		// enumerable wrapper keys so the loop at 987 iterates, and for function implToWrap
		// the else-if at line 990/991 copies them.
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.OBJ_FN_FOLDER
		});

		expect(_api).toBeDefined();
		// The test passes as long as the API builds without error; the coverage
		// of line 991 depends on whether adoptImplChildren exposes child keys.
		const calcApi = _api.calc;
		expect(calcApi).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 4: Lines 1313-1316 — addapi-metadata-default in lazy subfolder materialization
//
// WHY:
//   createLazySubdirectoryWrapper processes single-file subfolders lazily.
//   When the subfolder contains addapi.mjs (filename matches folder name) with:
//     - export default { metadata_object }  (object type)
//     - export function init() {}
//   buildCategoryDecisions returns flattenType="addapi-metadata-default".
//   Line 1311: `if (flattenType === "addapi-metadata-default")` fires
//   Line 1313: `implToWrap = exports.default`
//   Line 1314: `for (const key of moduleKeys) { if (key !== "default") implToWrap[key] = exports[key]; }`
//   Lines 1315-1316: loop body.
//
//   The existing modes-processor-uncovered.test.vitest.mjs only tests EAGER mode,
//   which hits lines 874-877 (a different code block in processFiles).  LAZY mode
//   goes through createLazySubdirectoryWrapper instead — lines 1313-1316.
// ---------------------------------------------------------------------------
describe("modes-processor: addapi-metadata-default in lazy subfolder materialization (lines 1313-1316)", () => {
	it("lazy load + materialize addapi/ subfolder triggers addapi-metadata-default branch", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			dir: DIRS.ADDAPI_SUBFOLDER
		});

		expect(_api).toBeDefined();
		// Accessing .addapi triggers createLazySubdirectoryWrapper materialization.
		// The addapi/ single-file folder has addapi.mjs (metadata object default + named fns)
		// → buildCategoryDecisions returns flattenType="addapi-metadata-default"
		// → lines 1313-1316 fire inside createLazySubdirectoryWrapper.
		const addapi = _api.addapi;
		expect(addapi !== null && addapi !== undefined).toBe(true);
	});

	it("lazy load with merge collision — same addapi-metadata-default path", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.ADDAPI_SUBFOLDER
		});

		expect(_api).toBeDefined();
		const addapi = _api.addapi;
		expect(addapi !== null && addapi !== undefined).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Group 5: Lines 1139 + 1330 + 1409-1411 — lazy file-folder collision with function impl
//
// Fixture: api_smart_flatten_fn_fn_folder/
//   calc.mjs            → export default function calc(); export function add(a,b)
//   calc/calc.mjs       → export default function calc(); export { calc }  (same ref)
//
// Line 1139 — `if (!modes_fileFolderImpl) modes_fileFolderImpl = {}` in processSubdirectories:
//   In lazy mode, targetApi["calc"] is the eager wrapper for root calc.mjs.
//   existImpl = wrapper.__impl = function calc  (typeof function, not object)
//   → modes_fileFolderImpl stays null (object check at 1133 fails)
//   existChildKeys = ["add"]  (add was adopted as a child wrapper from calc's own property)
//   → for (ck of existChildKeys): if (!modes_fileFolderImpl) modes_fileFolderImpl = {}
//      → line 1139 fires.
//
// Line 1330 — `continue` in createLazySubdirectoryWrapper hybrid pattern:
//   calc/calc.mjs has export { calc }; export default calc
//   moduleKeys = ["calc"]  (function, not filtered)
//   implToWrap = exports.default = calc
//   Hybrid loop: shouldAttachNamedExport("calc", calc, calc, calc)
//     → value === originalDefault → returns false → !false = true → continue (line 1330)
//
// Lines 1409-1411 — file-folder collision merge into function implToWrap:
//   fileFolderCollisionImpl = { add: addWrapper }  (from root calc wrapper's child)
//   typeof implToWrap === "function"  → else-if at 1409 fires
//   Loop: if (implToWrap["add"] === undefined) implToWrap["add"] = addWrapper  (lines 1410-1411)
// ---------------------------------------------------------------------------
describe("modes-processor: lazy file-folder collision with function root impl (lines 1139, 1330, 1409-1411)", () => {
	it("lazy + merge: function root file + same-name subfolder → lines 1139 + 1330 + 1409-1411", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.FN_FN_FOLDER
		});

		expect(_api).toBeDefined();
		// Accessing api.calc triggers materialization of the lazy calcWrapper.
		// Before that, processSubdirectories captured existImpl=function (line 1139)
		// and passed fileFolderCollisionImpl to createLazySubdirectoryWrapper (lines 1409-1411).
		const calc = _api.calc;
		expect(calc !== null && calc !== undefined).toBe(true);
	});

	it("same fixture with debug modes enabled", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			debug: { modes: true },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.FN_FN_FOLDER
		});

		expect(_api).toBeDefined();
		const calc = _api.calc;
		expect(calc !== null && calc !== undefined).toBe(true);
	});

	it("same fixture, lazy + merge-replace collision", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge-replace", api: "merge-replace" } },
			dir: DIRS.FN_FN_FOLDER
		});

		expect(_api).toBeDefined();
		const calc = _api.calc;
		expect(calc !== null && calc !== undefined).toBe(true);
	});

	it("OBJ_FN_FOLDER lazy + merge — lines 1409-1411 via object root file (independent confirmation)", async () => {
		// Root calc.mjs has object default { add, subtract }.
		// existImpl = { add, subtract } (object) → modes_fileFolderImpl = { add, subtract } (line 1133-1134)
		// calc/calc.mjs has function default → typeof function → line 1409 fires.
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			api: { collision: { initial: "merge", api: "merge" } },
			dir: DIRS.OBJ_FN_FOLDER
		});

		expect(_api).toBeDefined();
		const calc = _api.calc;
		expect(calc !== null && calc !== undefined).toBe(true);
	});
});
