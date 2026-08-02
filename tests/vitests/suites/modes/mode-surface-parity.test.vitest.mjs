/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modes/mode-surface-parity.test.vitest.mjs
 *	@Date: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Eager and lazy expose the same composed surface — load timing is the only difference.
 *
 * @description
 * A file+directory name collision (root `logger.mjs` + `logger/` with a self-named callable module
 * and a sibling) is the hardest composition shape: every member has to survive the merge in both
 * modes, in either access order. Eager used to REPLACE the category slot when it reached the
 * self-named callable, clobbering the root file's exports and any sibling attached earlier; lazy
 * used to answer with different surfaces depending on whether the callable had been invoked yet.
 * The contract pinned here: identical member set, identical values, identical call result — mode
 * and access order change WHEN modules load, never WHAT the api is.
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";

const DEBUG_BASE = new URL("../../../../api_tests/api_test_modes_debug", import.meta.url).pathname;

// Scratch fixture dirs, unique per run (repo convention: process.pid + Date.now), removed after each test.
const SCRATCH_ROOT = join(process.cwd(), "tmp", `mode-surface-parity-${process.pid}-${Date.now()}`);
let scratchCounter = 0;

/**
 * Create a fresh scratch base directory for an inline fixture.
 * @returns {string} Absolute path of the new empty base dir.
 */
function makeScratchBase() {
	const dir = join(SCRATCH_ROOT, String(++scratchCounter));
	mkdirSync(dir, { recursive: true });
	return dir;
}

// The full member set the collision must compose in every mode: the root file's named exports
// (log, source), the self-named callable's named export (level), and the sibling module (loggerMeta).
const EXPECTED_KEYS = ["level", "log", "loggerMeta", "source"];

/**
 * Assert one composed logger surface, whatever mode produced it.
 * @param {object|Function} logger - The resolved api.logger value.
 * @param {Function} read - Mode-appropriate member reader: (value) => resolved member.
 * @returns {Promise<void>} Resolves when every member has been asserted.
 */
const expectFullSurface = async (logger, read) => {
	expect(Object.keys(logger).sort()).toEqual(EXPECTED_KEYS);
	expect(await read(logger.level)).toBe("info");
	expect(await read(logger.source)).toBe("root");
	const log = await read(logger.log);
	expect(log("y")).toBe("[ROOT-LOG] y");
	const meta = await read(logger.loggerMeta);
	expect(Object.keys(meta).sort()).toEqual(["levels", "version"]);
	expect(await read(meta.version)).toBe("1.0.0");
};

describe("Modes > surface parity on a file+directory collision", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		rmSync(SCRATCH_ROOT, { recursive: true, force: true });
	});

	it("eager composes every colliding member onto the callable", async () => {
		api = await slothlet({ mode: "eager", base: DEBUG_BASE });

		expect(typeof api.logger).toBe("function");
		expect(api.logger("x")).toBe("[LOG] x");
		await expectFullSurface(api.logger, (v) => v);
	});

	it("lazy exposes the same surface when enumerated before any call", async () => {
		api = await slothlet({ mode: "lazy", base: DEBUG_BASE });

		// Await-first: the surface must already be the fully merged composition, not the root file's
		// share of it — enumeration is not allowed to depend on whether the callable ran yet.
		const logger = await api.logger;
		await expectFullSurface(logger, (v) => v);
		expect(await api.logger("x")).toBe("[LOG] x");
	});

	it("lazy exposes the same surface when called before enumerating", async () => {
		api = await slothlet({ mode: "lazy", base: DEBUG_BASE });

		expect(await api.logger("x")).toBe("[LOG] x");
		const logger = await api.logger;
		await expectFullSurface(logger, (v) => v);
	});

	it("eager replace-mode collision keeps the clobber semantics", async () => {
		api = await slothlet({ mode: "eager", base: DEBUG_BASE, collision: "replace" });

		// Under replace the self-named module's composition wins the slot outright — the merge that
		// default mode performs is deliberately skipped, so the root file's exports and the earlier
		// sibling stay off the surface.
		expect(typeof api.logger).toBe("function");
		expect(api.logger("x")).toBe("[LOG] x");
		expect(Object.keys(api.logger).sort()).toEqual(["level"]);
		expect(api.logger.level).toBe("info");
	});

	it("api.add() composes the collision to the same merged surface as an initial build", async () => {
		// The runtime-mount path used to suppress the self-named hoist at every depth of the added
		// tree (its mount prefix is set for the whole build), nesting the callable inside its own
		// namespace — the same directory must compose to the same surface at runtime as at boot.
		const NEUTRAL_BASE = new URL("../../../../api_tests/api_test", import.meta.url).pathname;
		api = await slothlet({ mode: "eager", base: NEUTRAL_BASE });

		await api.slothlet.api.add("ext", DEBUG_BASE);
		expect(typeof api.ext.logger).toBe("function");
		expect(api.ext.logger("x")).toBe("[LOG] x");
		expect(Object.keys(api.ext.logger).sort()).toEqual(EXPECTED_KEYS);
	});

	it("a generic-named single file composes transparently at its folder's path", async () => {
		const dir = makeScratchBase();
		// index.mjs contributes no api segment of its own: the folder is the namespace, the file is
		// transparent (#243 — the dropped segment must stay dropped in paths AND surface).
		mkdirSync(join(dir, "tools"));
		writeFileSync(join(dir, "tools", "index.mjs"), `export function probe() {\n\treturn "generic";\n}\n`);
		api = await slothlet({ mode: "eager", base: dir });

		expect(Object.keys(api.tools)).toEqual(["probe"]);
		expect(api.tools.probe()).toBe("generic");
	});
});
