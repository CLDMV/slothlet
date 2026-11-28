/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-run-checkpoint.test.vitest.mjs
 *	@Date: 2026-11-25T01:29:32-08:00 (1795598972)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:13-08:00 (1795869193)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A run reads the api as it was when the run started, while code outside the run changes it: a `Map` a
 * file exports by name is read as of the start when the file's own code changes it outside the run, also with a second
 * instance loaded from the same files, whose own `Map` is left as it was.
 *
 * The fixture is written to `tmp/uwa-run-checkpoint` when the file runs.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "uwa-run-checkpoint");
const BASE = path.join(ROOT, "api");

const DATA_SOURCE = `
export const cache = new Map();
export const other = { n: 1 };
export function touch() {
	cache.set("x", 1);
	return cache.size;
}
`;

const PROBE_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";
export function size() {
	return self.data.cache.size;
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["data", "probe"]) mkdirSync(path.join(BASE, dir), { recursive: true });
	writeFileSync(path.join(BASE, "data", "data.mjs"), DATA_SOURCE);
	writeFileSync(path.join(BASE, "probe", "probe.mjs"), PROBE_SOURCE);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Open a run that waits until told to read, then reads the size once.
 * @param {object} api - The api.
 * @returns {{read: function(): Promise<number>}} The run.
 */
function openRun(api) {
	let go;
	const gate = new Promise((resolve) => {
		go = resolve;
	});
	const done = api.slothlet.context.run({}, async () => {
		await gate;
		return api.probe.size();
	});
	return {
		read: () => {
			go();
			return done;
		}
	};
}

// Eager only: in lazy mode a Map read once from the host becomes a node of its own, and a run reads a built-in held as a
// node live (a known gap, reported separately), which this file does not assert.
const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "eager", runtime: "live" }
];

describe.each(CONFIGS)("a run reads an exported Map as of its start — $mode / $runtime", ({ mode, runtime }) => {
	const apis = [];

	afterEach(async () => {
		for (const api of apis.splice(0)) await api.slothlet.shutdown();
	});

	/**
	 * Load an instance of the fixture, with the data file and the probe loaded.
	 * @returns {Promise<object>} The api.
	 */
	async function load() {
		const api = await slothlet({ base: BASE, mode, runtime, silent: true });
		apis.push(api);
		await api.data.cache;
		await api.probe;
		expect(await api.probe.size()).toBe(0);
		return api;
	}

	it("keeps the Map as of the run's start when the file's code changes it outside the run", async () => {
		const api = await load();
		const run = openRun(api);
		expect(await api.data.touch()).toBe(1);
		expect(await run.read()).toBe(0);
		expect(await api.probe.size()).toBe(1);
	});

	it("keeps each instance's own Map apart when two instances load the same files", async () => {
		const first = await load();
		const second = await load();
		const run = openRun(first);
		expect(await first.data.touch()).toBe(1);
		expect(await run.read()).toBe(0);
		expect(await first.probe.size()).toBe(1);
		expect(await second.probe.size()).toBe(0);
	});
});
