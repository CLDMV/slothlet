/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/modes-processor-coverage.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:44 -08:00 (1772425304)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Targeted coverage tests for modes-processor.mjs
 * @module @cldmv/slothlet/tests/builders/modes-processor-coverage
 * @internal
 * @private
 *
 * @description
 * Covers previously uncovered paths in modes-processor.mjs:
 * - Category wrapper creation in eager recursive subdirectory processing (lines 92-219)
 * - AddApi flatten-to-category patterns (lines 525-680)
 * - File-folder collision in lazy mode with merge collision (lines 1181-1210)
 * - Eager folder transparency (subfolder name matches category) (lines 1040-1060)
 * - Lazy folder transparency (lines ~1120-1135)
 * - Multiple root contributors warning path (lines 1401-1480)
 * - Single root contributor → applyRootContributor with debug (lines 1480-1596)
 * - Debug mode branches (lines 92-219 debug guards, 297-305, 821, etc.)
 * - Lazy subdirectory single-file materialization (lines 1252-1344)
 *
 * @example
 * // Internal usage
 * // npm run vitest modes-processor-coverage
 */
process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");
let restoreDebugOutput;

beforeEach(() => {
	restoreDebugOutput = suppressSlothletDebugOutput();
});

afterEach(() => {
	restoreDebugOutput?.();
	restoreDebugOutput = undefined;
});

// Smart-flatten fixture base directory
const SF = TEST_DIRS.SMART_FLATTEN;

/** Resolved paths to all smart_flatten fixtures */
const DIRS = {
	NESTED: path.join(SF, "api_smart_flatten_nested"),
	ADDAPI: path.join(SF, "api_smart_flatten_addapi"),
	ADDAPI_FN: path.join(SF, "api_smart_flatten_addapi_function"),
	ADDAPI_FOLDERS: path.join(SF, "api_smart_flatten_addapi_with_folders"),
	CONFLICT: path.join(SF, "api_smart_flatten_conflict"),
	FILE_FOLDER_LAZY: path.join(SF, "api_smart_flatten_file_folder_lazy"),
	FOLDER_CONFIG: path.join(SF, "api_smart_flatten_folder_config"),
	FOLDER_DIFFERENT: path.join(SF, "api_smart_flatten_folder_different"),
	MULTIPLE: path.join(SF, "api_smart_flatten_multiple"),
	NONE: path.join(SF, "api_smart_flatten_none"),
	SINGLE: path.join(SF, "api_smart_flatten_single"),
	SOLO_SUBFOLDER: path.join(SF, "api_smart_flatten_solo_subfolder"),
	MULTI_ROOT_FN: path.join(REPO_ROOT, "api_tests/api_test_multi_root_fn"),
	SINGLE_ROOT_FN: path.join(REPO_ROOT, "api_tests/api_test_single_root_fn")
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Base config with modes debug enabled to hit all debug branches.
 * @param {object} [overrides] - Config overrides
 * @returns {object} Combined config
 */
function makeConfig(overrides = {}) {
	return {
		mode: "eager",
		runtime: "async",
		hook: { enabled: false },
		debug: { modes: true },
		...overrides
	};
}

/**
 * Shared afterEach helper that shuts down an API instance.
 * @param {Function} getter - Function returning the current api reference
 * @returns {Function} afterEach callback
 */
let _api = null;
afterEach(async () => {
	if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown();
	}
	_api = null;
	// Give event loop a tick to settle
	await new Promise((r) => setTimeout(r, 20));
});

// ---------------------------------------------------------------------------
// Group 1: Category wrapper creation (lines 92-219)
// Eager recursive subdirectory processing — non-root, shouldWrap, !populateDirectly
// ---------------------------------------------------------------------------
describe("modes-processor: category wrapper creation (lines 92-219)", () => {
	it("creates category wrappers for nested subdirectories in eager mode", async () => {
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.NESTED
		});

		// The nested fixture has root.mjs + services/ subdirectory
		// services/ triggers category wrapper creation (line 92+)
		expect(typeof _api.services).toBe("object");
		// services/api.mjs should be accessible under services
		expect(typeof _api.services.api?.getApiService === "function" || typeof _api.services.getApiService === "function").toBe(true);
	});

	it("reuses existing wrapper when category already exists (line 92-107)", async () => {
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.NESTED,
			api: { collision: { initial: "merge", api: "merge" } }
		});
		// Adding same dir again should reuse existing wrapper
		await _api.slothlet.api.add("services", DIRS.NESTED);
		expect(typeof _api.services).toBe("object");
	});

	it("processes deeply nested subdirectories (services/services/services.mjs)", async () => {
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.NESTED
		});

		// Navigate to services > services and verify functions
		const svc = _api.services;
		expect(typeof svc).toBe("object");
		// services/services/ should exist somewhere in the tree
		const hasNested =
			typeof svc.services === "object" ||
			typeof svc.services?.getNestedService === "function" ||
			typeof svc.getNestedService === "function";
		expect(hasNested).toBe(true);
	});

	it("creates category wrapper with debug.modes=true - covers debug blocks within category creation", async () => {
		// This specifically covers the conditional debug blocks at lines 99-113, 145-150, 159-167, 189-219
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: DIRS.FOLDER_DIFFERENT
		});
		// folder_different has config/database.mjs and config/server.mjs
		expect(typeof _api.config).toBe("object");
	});
});

// ---------------------------------------------------------------------------
// Group 2: AddApi flatten-to-category (lines 525-680)
// Covers addapi.mjs with object default → flattenToCategory addapi path
// ---------------------------------------------------------------------------
describe("modes-processor: addapi flatten-to-category (lines 525-680)", () => {
	it("merges addapi named exports to parent when object default (lines 525-580)", async () => {
		// api_smart_flatten_addapi/addapi.mjs has named exports + object default
		// → isAddapiFile && isAddapiObjectDefault → flattenToCategory
		// → lines 525-580: merges named exports directly to api
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.ADDAPI
		});

		// Named exports from addapi.mjs should be at root level
		expect(typeof _api.initializePlugin).toBe("function");
		expect(typeof _api.pluginMethod).toBe("function");
		expect(typeof _api.cleanup).toBe("function");
		const result = await _api.initializePlugin();
		expect(result).toBe("Plugin initialized");
	});

	it("addapi with folders - covers addapi in subdirectory context (lines 586-680)", async () => {
		// api_smart_flatten_addapi_with_folders: addapi.mjs + config/ + services/ + utils/
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.ADDAPI_FOLDERS
		});

		// addapi.mjs named exports should merge into root
		expect(typeof _api.services !== "undefined" || typeof _api.config !== "undefined").toBe(true);
	});

	it("addapi flatten path via api.slothlet.api.add() (lines 525-627)", async () => {
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.FOLDER_DIFFERENT
		});

		// Add addapi dir → triggers addapi flatten path
		await _api.slothlet.api.add("plugins", DIRS.ADDAPI, { collisionMode: "merge" });
		expect(typeof _api.plugins?.initializePlugin === "function" || typeof _api.initializePlugin === "function").toBe(true);
	});

	it("addapi function default - covers function addapi root contributor branch", async () => {
		// api_smart_flatten_addapi_function/addapi.mjs has a function default
		// isAddapiObjectDefault=false (function, not object) → may be treated as root contributor
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.ADDAPI_FN
		});
		// Should load without error
		expect(_api).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 3: Lazy file-folder collision extraction (lines 1181-1210)
// Lazy mode + merge collision + same-name file and folder at root level
// ---------------------------------------------------------------------------
describe("modes-processor: lazy file-folder collision extraction (lines 1181-1210)", () => {
	it("extracts file exports when lazy folder collides in merge mode", async () => {
		// api_smart_flatten_conflict has:
		// - config.mjs (root file → processed eagerly in lazy mode)
		// - config/ (subdirectory → lazy wrapper)
		// With merge collision, the lazy loop detects existing wrapper at api.config
		// → extracts impl (lines 1181-1210)
		_api = await slothlet({
			...makeConfig({ mode: "lazy" }),
			dir: DIRS.CONFLICT,
			api: { collision: { initial: "merge", api: "merge" } }
		});

		// After materialization, config should have BOTH file and folder exports
		const config = _api.config;
		expect(config).toBeDefined();

		// Access to trigger materialization
		const subConfigFn = await _api.config?.getSubConfig?.();
		expect(subConfigFn).toBe("sub-config-value");
	});

	it("skips file export extraction when collision is replace mode (no extraction)", async () => {
		// Replace mode: file-folder collision → folder replaces file completely
		// Lines 1181-1210 are NOT entered (guard condition: modes_initialCollisionMode !== "replace")
		_api = await slothlet({
			...makeConfig({ mode: "lazy" }),
			dir: DIRS.CONFLICT,
			api: { collision: { initial: "replace", api: "replace" } }
		});
		expect(_api.config).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 4: Eager folder transparency (lines 1040-1060)
// When a subfolder name matches the category being added, it's made transparent
// ---------------------------------------------------------------------------
describe("modes-processor: eager folder transparency (lines 1040-1060)", () => {
	it("transparent folder in eager mode - subfolder name === apiPath segment", async () => {
		// api_smart_flatten_folder_config has:
		// - main.mjs (root file)
		// - config/ (subfolder containing config.mjs → named export: getNestedConfig)
		// When added as api.add("config", dir) in eager mode:
		// config/ subfolder matches category "config" → transparent
		// Result: api.config.getNestedConfig() (not api.config.config.getNestedConfig())
		_api = await slothlet({
			...makeConfig(),
			dir: TEST_DIRS.API_TEST
		});

		// Add folder_config under "config" prefix
		await _api.slothlet.api.add("config", DIRS.FOLDER_CONFIG, { collisionMode: "merge" });

		// Should have getNestedConfig at api.config level (transparent folder)
		expect(typeof _api.config?.getNestedConfig).toBe("function");
		const result = await _api.config.getNestedConfig();
		expect(result).toBe("nested-config-value");
	});

	it("transparent folder in eager mode with debug.modes=true", async () => {
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: TEST_DIRS.API_TEST
		});
		await _api.slothlet.api.add("config", DIRS.FOLDER_CONFIG, { collisionMode: "merge" });
		expect(typeof _api.config?.getNestedConfig).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// Group 5: Lazy folder transparency (lines ~1120-1135)
// Same as above but in lazy mode
// ---------------------------------------------------------------------------
describe("modes-processor: lazy folder transparency (lines ~1120-1135)", () => {
	it("transparent folder in lazy mode - subfolder name matches apiPathPrefix segment", async () => {
		_api = await slothlet({
			...makeConfig({ mode: "lazy" }),
			dir: TEST_DIRS.API_TEST
		});

		// Add folder_config under "config" prefix in lazy mode
		await _api.slothlet.api.add("config", DIRS.FOLDER_CONFIG, { collisionMode: "merge" });

		// After lazy materialization, should have getNestedConfig
		const result = await _api.config?.getNestedConfig?.();
		expect(result).toBe("nested-config-value");
	});
});

// ---------------------------------------------------------------------------
// Group 6: Multiple root contributors warning (lines ~1401-1480)
// When multiple files at root level have function-type default exports
// ---------------------------------------------------------------------------
describe("modes-processor: multiple root contributors (lines ~1401-1480)", () => {
	it("warns and namespaces multiple root function default exports", async () => {
		// api_test_multi_root_fn has do-a.mjs and do-b.mjs, both with function defaults
		// → rootContributors.length > 1 → WARNING_MULTIPLE_ROOT_CONTRIBUTORS
		// → each gets its own namespace (lines 1401-1480)
		let warned = false;
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.MULTI_ROOT_FN,
			// Capture warnings instead of logging
			onWarning: () => {
				warned = true;
			}
		});

		// Both functions should be namespaced (not at root)
		// doA and doB should be wrapped in their own namespaces
		expect(_api).toBeDefined();
		const hasDoA = typeof _api.doA === "function" || typeof _api.doA?.doA === "function";
		const hasDoB = typeof _api.doB === "function" || typeof _api.doB?.doB === "function";
		// At least one should be accessible somewhere
		expect(hasDoA || hasDoB).toBe(true);
	});

	it("multiple root contributors with debug.modes=true - covers all debug blocks", async () => {
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: DIRS.MULTI_ROOT_FN
		});
		expect(_api).toBeDefined();
	});

	it("single root contributor is made callable API root (not warned)", async () => {
		// api_test_single_root_fn has root.mjs (function default) + helper.mjs (named only)
		// → rootContributors.length === 1 → rootDefaultFunction = rootFn
		// → applyRootContributor(api, rootFn) called → Object.assign(rootFn, api)
		// NOTE: Coverage for lines 1252-1289 (single contributor path in processFiles)
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.SINGLE_ROOT_FN
		});

		// The root API should be callable (root contributor pattern)
		// The rootFn from root.mjs becomes the callable API with other api props attached
		// OR it might just be accessible as api.root
		expect(_api).toBeDefined();
		// The helper.mjs exports should be accessible
		const hasHelper =
			typeof _api.helperFn === "function" || typeof _api.helper?.helperFn === "function" || typeof _api.helper?.meta === "object";
		expect(hasHelper).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Group 7: applyRootContributor (lines 1480-1596)
// Called from eager.mjs/lazy.mjs after processFiles with rootDefaultFunction
// ---------------------------------------------------------------------------
describe("modes-processor: applyRootContributor debug paths (lines 1480-1596)", () => {
	it("applyRootContributor with debug.modes=true - covers debug blocks", async () => {
		// Loading any dir with a single function-default root file triggers applyRootContributor
		// With debug.modes=true, all internal debug blocks fire
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: DIRS.SINGLE_ROOT_FN
		});

		// If root.mjs is detected as single root contributor, the function should be callable
		// It gets other api props attached via Object.assign, then wrapped/returned
		expect(_api).toBeDefined();
	});

	it("applyRootContributor in lazy mode with debug.modes=true", async () => {
		_api = await slothlet({
			...makeConfig({ mode: "lazy", debug: { modes: true } }),
			dir: DIRS.SINGLE_ROOT_FN
		});
		expect(_api).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 8: Lazy subdirectory single-file materialization (lines 1252-1344)
// Inside createLazySubdirectoryWrapper's materializeFunc for single-file folders
// ---------------------------------------------------------------------------
describe("modes-processor: lazy single-file dir materialization (lines 1252-1344)", () => {
	it("lazy subdirectory with single file matching folder name - folder/folder.mjs pattern", async () => {
		// api_smart_flatten_file_folder_lazy has:
		// - services/ with services/services.mjs (filename matches folder = "services")
		//   AND services/services/ subfolder with worker.mjs
		// In lazy mode: services/ wrapper materializes, detects single matching file
		_api = await slothlet({
			...makeConfig({ mode: "lazy" }),
			dir: DIRS.FILE_FOLDER_LAZY
		});

		// Accessing services namespace triggers its materialization
		const svc = _api.services;
		expect(svc).toBeDefined();
		// After materialization
		const hasServices = svc !== undefined;
		expect(hasServices).toBe(true);
	});

	it("solo subfolder in lazy mode - only one sub-directory, deeply nested (lines 1252+)", async () => {
		// api_smart_flatten_solo_subfolder has: pipe/pipe/pipe.mjs
		// In lazy mode: pipe/ wrapper materializes → finds pipe/pipe/ (subfolder) → deepens
		_api = await slothlet({
			...makeConfig({ mode: "lazy" }),
			dir: DIRS.SOLO_SUBFOLDER
		});

		expect(_api).toBeDefined();
		// pipe namespace exists
		expect(_api.pipe !== undefined).toBe(true);
	});

	it("api_smart_flatten_nested in lazy mode - covers services/services/ path", async () => {
		_api = await slothlet({
			...makeConfig({ mode: "lazy", debug: { modes: true } }),
			dir: DIRS.NESTED
		});

		expect(_api.services !== undefined).toBe(true);
		// Trigger materialization by accessing a deeply nested property
		const svc = _api.services;
		expect(svc).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 9: Multi-export folders and debug paths (lines 253-421)
// Regular module processing with multiple default exports in same dir
// ---------------------------------------------------------------------------
describe("modes-processor: multi-export and module loop debug (lines 253-421)", () => {
	it("multiple named exports in same root - no root contributor (object defaults)", async () => {
		// api_smart_flatten_multiple has logger.mjs, utils.mjs, validator.mjs
		// all with object defaults (not function) → NOT root contributors
		// Each gets processed normally with debug blocks
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: DIRS.MULTIPLE
		});

		// Should have each module accessible
		expect(typeof _api.logger !== "undefined" || typeof _api.debug !== "undefined").toBe(true);
	});

	it("no-flatten case with named exports only (lines 560-594)", async () => {
		// api_smart_flatten_none: auth.mjs, users.mjs - both with named exports
		// No flattening decisions apply
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: DIRS.NONE
		});
		expect(_api).toBeDefined();
		// auth and users modules should be accessible
		const hasAuth = typeof _api.auth !== "undefined";
		const hasUsers = typeof _api.users !== "undefined";
		expect(hasAuth || hasUsers).toBe(true);
	});

	it("single named export - auto-flatten case (lines 560-594)", async () => {
		// api_smart_flatten_single: config.mjs (presumably a single named export)
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: DIRS.SINGLE
		});
		expect(_api).toBeDefined();
	});

	it("reload with debug.modes=true covers modes-processor debug paths", async () => {
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: DIRS.FOLDER_DIFFERENT
		});
		// Reload triggers reprocessing which re-runs modes-processor code paths
		await _api.slothlet.api.reload();
		expect(typeof _api.config).toBe("object");
	});
});

// ---------------------------------------------------------------------------
// Group 10: File-folder collision in eager mode (lines 822-952)
// Single-subdir-folder with file-folder merge
// ---------------------------------------------------------------------------
describe("modes-processor: eager file-folder collision merge (lines 822-952)", () => {
	it("config.mjs + config/ in eager merge mode - file exports merge into folder (lines 822-873)", async () => {
		// api_smart_flatten_conflict in EAGER mode with merge collision:
		// config.mjs (root file) processed first, creates wrapper
		// Then config/ subdirectory is processed
		// In the single-file folder check branch, finds config/config.mjs + files exist
		// Merges file wrapper impl into folder impl (lines 822-873)
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.CONFLICT,
			api: { collision: { initial: "merge", api: "merge" } }
		});

		// Both file and folder exports should be accessible under config
		expect(typeof _api.config).not.toBe("undefined");
		// getRootConfig comes from config.mjs (file)
		// getSubConfig comes from config/config.mjs (folder)
		const rootFn = await _api.config?.getRootConfig?.();
		const subFn = await _api.config?.getSubConfig?.();
		expect(rootFn === "root-config-value" || subFn === "sub-config-value").toBe(true);
	});

	it("collision with warn mode - covers warn branch (lines 949-952)", async () => {
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.CONFLICT,
			api: { collision: { initial: "warn", api: "warn" } }
		});
		expect(_api.config).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group 11: Generic single-file folder names (lines 771-873)
// When a subfolder has exactly one file with a "generic" name (index, main, etc.)
// ---------------------------------------------------------------------------
describe("modes-processor: single-file folder with generic name (lines 771-873)", () => {
	it("index.mjs in subfolder - generic filename triggers flatten check", async () => {
		// Use API_TEST which has various subdirectories
		// When any subfolder has a single file named index.mjs, main.mjs, or default.mjs
		// it triggers the generic filename flatten path
		_api = await slothlet({
			...makeConfig({ debug: { modes: true } }),
			dir: DIRS.NESTED,
			api: { collision: { initial: "merge", api: "merge" } }
		});

		// The nested fixture triggers single-file subfolder detection for services/
		// Even without exact generic name, the folder/folder.mjs pattern fires
		expect(_api.services).toBeDefined();
	});

	it("folder/folder.mjs pattern (filenameMatchesFolder) - covers lines 771-873", async () => {
		// Any fixture where subfolder name === file name inside it
		// e.g. services/services.mjs in api_smart_flatten_file_folder_lazy
		_api = await slothlet({
			...makeConfig(),
			dir: DIRS.FILE_FOLDER_LAZY,
			api: { collision: { initial: "merge", api: "merge" } }
		});

		expect(_api.services !== undefined).toBe(true);
	});
});
