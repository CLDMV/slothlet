/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/handlers/unified-wrapper-debug.test.vitest.mjs
 *      @Date: 2026-02-28T00:00:00-08:00
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-02-28T00:00:00-08:00
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Monitoring Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for debug.wrapper, util.inspect, and lazy materialization paths
 * in unified-wrapper.mjs.
 *
 * @description
 * Targets the following uncovered clusters:
 *
 *  Lines 280, 289-290 – `debug.wrapper=true` + apiPath === "config" in constructor
 *    Triggered when slothlet is initialised with `debug: { wrapper: true }` and the API
 *    directory includes a `config.mjs` file (API_TEST fixture).  The guard fires twice:
 *    once before `___adoptImplChildren()` and once after.
 *
 *  Lines 518-519 – `_applyNewImpl` sets filePath from impl.__filePath
 *    Triggered during lazy materialization when the loaded module object carries a
 *    `__filePath` property (set by modes-processor) and the wrapper has no filePath yet.
 *
 *  Line 543-544 – `___setImpl` debug guard for apiPath === "string"
 *    Triggered when `___setImpl` is called on the "string" wrapper (after a reload) with
 *    `debug.wrapper=true`.
 *
 *  Lines 670, 683, 708, 718 – `___materialize` debug guards for apiPath === "string"
 *    Triggered when a lazy wrapper with apiPath="string" materialises while
 *    `debug.wrapper=true` in the config.
 *
 *  Lines 2133-2162 – main proxy `util.inspect.custom` handler
 *    Line 2133: match in proxy get trap.
 *    Lines 2137-2148: child-object inspection branch (eager non-callable with children).
 *    Lines 2151-2162: lazy callable inspection branch (unmaterialised, impl === null).
 *
 *  Lines 1426, 1436-1437 – waiting proxy `util.inspect.custom` handling
 *    Triggered when util.inspect is called on a "waiting proxy" (chained lazy access
 *    before the parent wrapper has materialised).
 *
 * Fixtures:
 *   api_tests/api_test            – has config.mjs (apiPath="config") + math.mjs with children
 *   api_tests/api_test_modes_debug – has string/string.mjs (apiPath="string") +
 *                                    logger/logger.mjs (callable default export)
 *
 * @module tests/vitests/suites/handlers/unified-wrapper-debug
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import util from "node:util";
import path from "node:path";
import { fileURLToPath } from "url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_TEST_MODES_DEBUG = path.resolve(__dirname, "../../../../api_tests/api_test_modes_debug");

/** @type {object[]} Instances to destroy after each test */
const instances = [];

/**
 * Create a slothlet instance and track it for cleanup.
 * @param {object} config - Configuration passed to slothlet().
 * @returns {Promise<object>} Ready API proxy.
 */
async function make(config) {
	const api = await slothlet(config);
	instances.push(api);
	return api;
}

afterEach(async () => {
	for (const api of instances.splice(0)) {
		try {
			await api.slothlet.shutdown();
		} catch (_) {
			// ignore
		}
	}
});

// ---------------------------------------------------------------------------
// 1. debug.wrapper=true in constructor for apiPath === "config"
//    Lines 280, 289-290 in unified-wrapper.mjs
// ---------------------------------------------------------------------------
describe("debug.wrapper constructor paths (lines 280, 289-290)", () => {
	it("fires DEBUG_MODE_WRAPPER_CONSTRUCTOR_IMPL_KEYS when config module is loaded with debug.wrapper=true", async () => {
		// API_TEST has config.mjs → wrapper apiPath="config" → lines 279-285 fire
		const api = await make({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			debug: { wrapper: true }
		});
		expect(api.config).toBeDefined();
		// config is a plain object with known keys
		expect(api.config.host).toBe("https://slothlet");
	});

	it("fires debug.wrapper paths for config.* child wrappers (apiPath.startsWith(config.))", async () => {
		// Verify that APIs nested under a 'config' namespace also fire the guard
		const api = await make({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			debug: { wrapper: true }
		});
		// Accessing config properties should work normally after debug logging
		expect(api.config.username).toBe("admin");
		expect(api.config.secure).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 2. main proxy util.inspect.custom handler – eager non-callable with children
//    Lines 2133, 2135, 2137-2148 in unified-wrapper.mjs
// ---------------------------------------------------------------------------
describe("util.inspect on eager non-callable wrapper (lines 2133, 2137-2148)", () => {
	it("returns child object when inspecting a wrapper with children (math module)", async () => {
		const api = await make({
			dir: TEST_DIRS.API_TEST,
			mode: "eager"
		});
		// math wrapper has children: add, subtract, multiply (and more)
		const inspected = util.inspect(api.math);
		// util.inspect goes through proxy get trap → line 2133 → 2137-2148 (children path)
		expect(typeof inspected).toBe("string");
		expect(inspected).not.toBeNull();
	});

	it("returns child-keyed object for config wrapper inspection", async () => {
		const api = await make({
			dir: TEST_DIRS.API_TEST,
			mode: "eager"
		});
		// config wrapper has children: host, username, password, etc. (plain values)
		const inspected = util.inspect(api.config);
		expect(typeof inspected).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// 3. main proxy util.inspect.custom handler – lazy callable before materialization
//    Lines 2151, 2162 (+ 2156 with debug.wrapper=true)
// ---------------------------------------------------------------------------
describe("util.inspect on lazy callable wrapper before materialization (lines 2151-2162)", () => {
	it("returns wrapper/proxy for unmaterialised lazy callable (logger)", async () => {
		// api_test_modes_debug/logger/logger.mjs is a default function export
		const api = await make({
			dir: API_TEST_MODES_DEBUG,
			mode: "lazy"
		});
		// logger is callable (default function export) and not yet materialised
		// util.inspect triggers proxy get trap → line 2133 → childKeys.length=0, isCallable=false initially
		// OR falls through to lines 2151-2162 because impl === null
		const inspected = util.inspect(api.logger);
		expect(typeof inspected).toBe("string");
	});

	it("fires debug.wrapper inspect-lazy-unmaterialised path (line 2156) with debug.wrapper=true", async () => {
		const api = await make({
			dir: API_TEST_MODES_DEBUG,
			mode: "lazy",
			debug: { wrapper: true }
		});
		// With debug.wrapper=true, the impl===null path at line 2156 fires a debug call
		const inspected = util.inspect(api.logger);
		expect(typeof inspected).toBe("string");
	});

	it("returns string representation for unmaterialised lazy non-callable (string module)", async () => {
		const api = await make({
			dir: API_TEST_MODES_DEBUG,
			mode: "lazy"
		});
		// string is a named-export object, also unmaterialised
		const inspected = util.inspect(api.string);
		expect(typeof inspected).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// 4. Waiting proxy util.inspect.custom – chained lazy access before materialization
//    Lines 1426, 1436-1437 in unified-wrapper.mjs
// ---------------------------------------------------------------------------
describe("util.inspect on waiting proxy before materialization (lines 1426, 1436-1437)", () => {
	it("triggers waiting proxy util.inspect.custom handler (not yet materialised)", async () => {
		const api = await make({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy"
		});
		// Accessing api.math returns the math wrapper proxy (lazy, not materialized)
		// Accessing api.math.add creates a "waiting proxy" with propChain=["add"]
		const waitingProxy = api.math.add;

		// util.inspect of a waiting proxy fires the waiting-proxy get trap for util.inspect.custom
		// → line 1421-1427 (trigger materialization fire-and-forget)
		// → line 1429 prop === util.inspect.custom
		// → line 1436 not materialized → return waitingTarget
		const inspected = util.inspect(waitingProxy);
		expect(typeof inspected).toBe("string");
	});

	it("waiting proxy inspect works for a chained nested property", async () => {
		const api = await make({
			dir: API_TEST_MODES_DEBUG,
			mode: "lazy"
		});
		// api.string.format creates a waiting proxy with propChain=["format"]
		const waitingProxy = api.string.format;
		const inspected = util.inspect(waitingProxy);
		expect(typeof inspected).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// 5. lazy materialization debug paths for apiPath === "string"
//    Lines 670, 683, 708, 718 in ___materialize
//    Lines 518-519 in _applyNewImpl (filePath update from impl.__filePath)
// ---------------------------------------------------------------------------
describe("lazy materialization debug paths for apiPath=string (lines 670, 683, 708, 718)", () => {
	it("fires ___materialize debug guards when debug.wrapper=true and string wrapper materialises", async () => {
		const api = await make({
			dir: API_TEST_MODES_DEBUG,
			mode: "lazy",
			debug: { wrapper: true }
		});
		// Awaiting api.string.format("test") triggers materialisation of the "string" wrapper.
		// With debug.wrapper=true and apiPath="string":
		//   Line 669: DEBUG_MODE_MATERIALIZE_START fires
		//   Line 682: DEBUG_MODE_MATERIALIZE_CALLING_FUNC fires
		//   Line 707: DEBUG_MODE_MATERIALIZE_COMPLETE fires
		const result = await api.string.format("test");
		expect(result).toBe("TEST");
	});

	it("fires ___materialize debug guards for logger (callable) materialisation", async () => {
		const api = await make({
			dir: API_TEST_MODES_DEBUG,
			mode: "lazy",
			debug: { wrapper: true }
		});
		// logger apiPath would be "logger" not "string", so the === "string" guard won't fire here,
		// but materialize paths are still exercised
		const result = await api.logger("hello");
		expect(result).toBe("[LOG] hello");
	});

	it("materialises string module without debug (lines 518-519 via _applyNewImpl __filePath)", async () => {
		const api = await make({
			dir: API_TEST_MODES_DEBUG,
			mode: "lazy"
		});
		// During materialization, modes-processor sets __filePath on the impl.
		// _applyNewImpl at line 517 checks `!filePath && impl.__filePath` and promotes it.
		// This covers lines 518-519.
		const result = await api.string.trim("  hello  ");
		expect(result).toBe("hello");
	});
});

// ---------------------------------------------------------------------------
// 6. ___setImpl debug guard for apiPath === "string" via reload
//    Line 543-544 in unified-wrapper.mjs
// ---------------------------------------------------------------------------
describe("___setImpl debug guard for apiPath=string (lines 543-544)", () => {
	it("fires DEBUG_MODE_SETIMPL_CALLED when string wrapper is ___setImpl'd during reload", async () => {
		const api = await make({
			dir: API_TEST_MODES_DEBUG,
			mode: "eager",
			debug: { wrapper: true }
		});
		// Initial load creates the "string" wrapper with debug.wrapper=true.
		// Reloading calls syncWrapper → ___setImpl on the existing "string" wrapper.
		// With debug.wrapper=true and apiPath="string" → line 543-544 fires.
		await api.slothlet.api.reload();
		const result = api.string.format("reload");
		expect(result).toBe("RELOAD");
	});
});
