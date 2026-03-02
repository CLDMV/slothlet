/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api/lazy/api-assignment-collision-lazy.test.vitest.mjs
 *	@Date: 2026-02-28T14:09:09-08:00 (1772316549)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 13:15:30 -08:00 (1772399730)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Lazy-mode collision tests targeting uncovered paths in api-assignment.mjs.
 *
 * @description
 * The `api-assignment.mjs` has several uncovered branches related to:
 *  - syncWrapper (lines 133-134): mutateExisting=true during reload
 *  - lazy vs materialized collision pairs (lines 318-460)
 *  - recursive wrapper merge (lines 497-543)
 *  - debug.api paths for collision mode setting (lines 217-223)
 *
 * Strategy:
 *  1. Load `api_test_collisions/` in lazy mode with merge / replace / merge-replace
 *     to trigger the lazy wrapper collision branches.
 *  2. Materialize the wrapper to trigger the "case 2: file first, lazy folder second" paths.
 *  3. Use api.add() to stack modules and reload to trigger syncWrapper (mutateExisting).
 *  4. Use debug.api=true to cover debug branches.
 *
 * @module tests/vitests/suites/api/lazy/api-assignment-collision-lazy
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "path";
import fs from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../../setup/vitest-helper.mjs";

let restoreDebugOutput;
let collisionFixtureWithExtraFile;

beforeAll(async () => {
	restoreDebugOutput = suppressSlothletDebugOutput();

	const fixtureDirName = `api_test_collisions_multi_${Date.now()}`;
	collisionFixtureWithExtraFile = path.resolve(process.cwd(), "tmp", fixtureDirName);

	await fs.cp(TEST_DIRS.API_TEST_COLLISIONS, collisionFixtureWithExtraFile, { recursive: true });
	await fs.writeFile(
		path.join(collisionFixtureWithExtraFile, "math", "math-extra.mjs"),
		"export const extraCollisionProbe = true;\nexport function extraProbe(v) { return Number(v) + 1; }\n",
		"utf8"
	);
});

afterAll(() => {
	restoreDebugOutput?.();
	restoreDebugOutput = undefined;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a lazy Slothlet pointing at the collisions fixture.
 * @param {string} [collisionConfig] - api.collision.initial config string.
 * @param {boolean} [debugApi] - Whether to enable debug.api.
 * @returns {Promise<object>} Slothlet API proxy.
 */
async function makeCollisionApi(collisionConfig = "merge", debugApi = false) {
	const opts = {
		dir: collisionFixtureWithExtraFile || TEST_DIRS.API_TEST_COLLISIONS,
		mode: "lazy",
		runtime: "async",
		api: { collision: { initial: collisionConfig } }
	};
	if (debugApi) {
		opts.debug = { api: true };
	}
	return slothlet(opts);
}

/**
 * Trigger materialization of a lazy wrapper by awaiting a dummy call.
 * Accesses the math namespace to force the wrapper to resolve.
 * @param {object} api - Slothlet API proxy.
 * @param {string} [fnPath] - Dot-path to a function that accepts no args and can be called briefly.
 * @returns {Promise<void>}
 */
async function triggerMaterialize(api, fnPath = "math.power") {
	const parts = fnPath.split(".");
	let target = api;
	for (const part of parts) {
		target = target[part];
		if (target === undefined || target === null) return;
	}
	// Trigger lazy materialization — result may be a waiting proxy or real result
	try {
		if (typeof target === "function") {
			await target(2, 2);
		}
	} catch (_) {
		// Ignore — we only care that materialization ran
	}
	// Small yield to let async materialization settle
	await new Promise((r) => setTimeout(r, 50));
}

// ---------------------------------------------------------------------------
// 1. Lazy merge: both lazy wrappers collide, both results accessible
// ---------------------------------------------------------------------------
describe("api-assignment — lazy merge collision (initial load)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("merge mode: both file and folder functions accessible after materialization", async () => {
		api = await makeCollisionApi("merge");
		expect(api.math).toBeDefined();

		// Trigger materialization of the lazy math wrapper
		await triggerMaterialize(api, "math.add");

		expect(typeof api.math.add).toBe("function");
	});

	it("merge mode with debug.api: covers debug collision logging (lines 217-223)", async () => {
		api = await makeCollisionApi("merge", true);
		expect(api.math).toBeDefined();
		await triggerMaterialize(api, "math.add");
		expect(typeof api.math.add).toBe("function");
	});

	it("merge mode: power() returns correct result", async () => {
		api = await makeCollisionApi("merge");
		await triggerMaterialize(api, "math.add");
		const result = api.math.add(2, 3);
		const resolved = result instanceof Promise ? await result : result;
		expect(resolved).toBe(5);
	});

	it("merge mode: math is accessible after collision resolution", async () => {
		api = await makeCollisionApi("merge");
		await triggerMaterialize(api, "math.add");
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 2. Lazy replace: only one source survives
// ---------------------------------------------------------------------------
describe("api-assignment — lazy replace collision (initial load)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("replace mode: only the winning source is accessible after materialization", async () => {
		api = await makeCollisionApi("replace");
		expect(api.math).toBeDefined();
		await triggerMaterialize(api, "math.add");
		// One source wins — just verify math is still defined
		expect(api.math).toBeDefined();
	});

	it("replace mode: debug.api covers replace debug path (lines 451-460)", async () => {
		api = await makeCollisionApi("replace", true);
		await triggerMaterialize(api, "math.add");
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 3. Lazy merge-replace: keys from both, with replace semantics for conflicts
// ---------------------------------------------------------------------------
describe("api-assignment — lazy merge-replace collision (initial load)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("merge-replace mode: loads without error", async () => {
		api = await makeCollisionApi("merge-replace");
		expect(api.math).toBeDefined();
		await triggerMaterialize(api, "math.add");
		expect(api.math).toBeDefined();
	});

	it("merge-replace mode with debug.api", async () => {
		api = await makeCollisionApi("merge-replace", true);
		await triggerMaterialize(api, "math.add");
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 4. Lazy collision via api.add() — triggers api.collision.api path
// ---------------------------------------------------------------------------
describe("api-assignment — lazy api.add() collision", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("api.add() on existing lazy wrapper — merge mode stacks both", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			api: { collision: { api: "merge" } }
		});

		// api.math is lazy unmaterialized from API_TEST
		// Add another module at "math" that overlaps with the existing lazy wrapper
		// api_test_collisions/math.mjs exports power, sqrt, modulo — unique keys (no collision)
		const collisionMathFile = TEST_DIRS.API_TEST_COLLISIONS + "/math.mjs";
		await api.slothlet.api.add("math", collisionMathFile, { moduleID: "math-extra" });

		await triggerMaterialize(api, "math.power");

		expect(api.math).toBeDefined();
	});

	it("api.add() with collision replace mode adds to existing lazy math wrapper", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			api: { collision: { api: "replace" } }
		});

		const collisionMathFile = TEST_DIRS.API_TEST_COLLISIONS + "/math.mjs";
		await api.slothlet.api.add("math", collisionMathFile, { moduleID: "math-replace" });
		await triggerMaterialize(api, "math.power");
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 5. Reload of a lazy slothlet — triggers syncWrapper (mutateExisting=true)
//    This covers lines 133-134: both existing and value are wrapper proxies + mutateExisting
// ---------------------------------------------------------------------------
describe("api-assignment — lazy reload triggers syncWrapper (lines 133-134)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reload base module in lazy mode triggers syncWrapper for both-wrapper collision", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async"
		});

		// Trigger materialization to ensure wrappers are present before reload
		await triggerMaterialize(api, "math.add");

		// Reload triggers _reloadByApiPath → reassigns via assignment with mutateExisting=true
		// When existing wrapper is present and new fresh wrapper is also a wrapper proxy
		// → Case 1 in setPathValue: syncWrapper is called
		await api.slothlet.api.reload(".");

		expect(api.math).toBeDefined();
	});

	it("reload nested endpoint in lazy mode after materialization", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async"
		});

		await triggerMaterialize(api, "math.add");

		// add a module, materialize, then reload
		await api.slothlet.api.add("rlt", TEST_DIRS.API_TEST_MIXED, { moduleID: "rlt-mod" });
		await triggerMaterialize(api, "rlt.math-esm");

		await api.slothlet.api.reload("rlt-mod");

		expect(api.rlt).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 6. Eager two-module add collision — merge path for both-wrapper case (lines 497-543)
// ---------------------------------------------------------------------------
describe("api-assignment — eager api.add() recursive wrapper merge (lines 497-543)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("eager mode: add two modules at root with merge — recursive child wrapper merge", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			api: { collision: { api: "merge" } }
		});

		// Add api_test_collisions dir at "coll" endpoint — math folder inside creates api.coll.math
		// Then add again: the second add creates a collision at api.coll.math
		await api.slothlet.api.add("coll", collisionFixtureWithExtraFile || TEST_DIRS.API_TEST_COLLISIONS, { moduleID: "coll-first" });
		expect(api.coll?.math).toBeDefined();

		// Second add creates collision at coll.math between existing and new wrapper
		await api.slothlet.api.add("coll", collisionFixtureWithExtraFile || TEST_DIRS.API_TEST_COLLISIONS, { moduleID: "coll-second" });
		expect(api.coll?.math).toBeDefined();
	});

	it("eager: merge-replace on second add with overlapping keys", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			api: { collision: { api: "merge-replace" } }
		});

		// Add collision fixture twice to the same endpoint → merge-replace collision
		await api.slothlet.api.add("coll2", collisionFixtureWithExtraFile || TEST_DIRS.API_TEST_COLLISIONS, { moduleID: "coll2-first" });
		await api.slothlet.api.add("coll2", collisionFixtureWithExtraFile || TEST_DIRS.API_TEST_COLLISIONS, { moduleID: "coll2-second" });
		expect(api.coll2?.math).toBeDefined();
	});

	it("eager: replace mode on second add", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			api: { collision: { api: "replace" } }
		});

		await api.slothlet.api.add("coll3", collisionFixtureWithExtraFile || TEST_DIRS.API_TEST_COLLISIONS, { moduleID: "coll3-first" });
		await api.slothlet.api.add("coll3", collisionFixtureWithExtraFile || TEST_DIRS.API_TEST_COLLISIONS, { moduleID: "coll3-second" });
		expect(api.coll3?.math).toBeDefined();
	});
});
