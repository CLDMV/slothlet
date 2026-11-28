/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/runtime/runtime-instanceid-entries.test.vitest.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:58-08:00 (1795869178)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Both runtimes export the same `instance`, and the auto-selecting entry answers through either (#764).
 *
 * @description
 * One expectation table for both runtimes, read through the instance's own runtime entry and through
 * `@cldmv/slothlet/runtime`:
 *
 * | Where it is read                     | `instance.id`                        |
 * | ------------------------------------ | ------------------------------------ |
 * | in a call of instance A (or B)       | A's id (B's id), a string            |
 * | after the call waited                | A's id                               |
 * | in a call inside `run()` on A        | the `run()` store's id (`A__run_…`)  |
 * | in the host's `run()` callback on A  | the `run()` store's id               |
 * | in the host's code, outside any call | undefined                            |
 *
 * Fixture `api_test_runtime_instanceid`: `probe.now(entry)` / `probe.later(entry)` read the export of `entry`
 * (`"auto"`, `"async"`, `"live"`) inside the call.
 * @module tests/vitests/suites/runtime/runtime-instanceid-entries
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import * as auto from "@cldmv/slothlet/runtime";
import * as asyncRuntime from "@cldmv/slothlet/runtime/async";
import * as liveRuntime from "@cldmv/slothlet/runtime/live";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_runtime_instanceid");
const ENTRIES = { auto, async: asyncRuntime, live: liveRuntime };

const matrix = ["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime })));

/**
 * What a read inside a call of the instance whose id is `id` gives.
 * @param {string} id - The id.
 * @returns {object} The expected read.
 */
const inCall = (id) => ({ id, type: "string" });

/**
 * How `instance.id` of one entry reads in the host's own code.
 * @param {string} entry - The entry.
 * @returns {object} The read.
 */
function hostRead(entry) {
	const id = ENTRIES[entry].instance.id;
	return { id, type: typeof id };
}

const OUTSIDE = { id: undefined, type: "undefined" };

describe.each(matrix)("instance.id of each runtime entry > $mode / $runtime", ({ mode, runtime }) => {
	const apis = [];

	afterEach(async () => {
		for (const api of apis.splice(0)) await api.shutdown();
	});

	/**
	 * Build an instance.
	 * @returns {Promise<object>} Its api.
	 */
	async function open() {
		const api = await slothlet({ base: BASE, mode, runtime, silent: true });
		apis.push(api);
		return api;
	}

	describe.each(["auto", runtime])("read through the %s entry", (entry) => {
		it("names the instance inside its call, and after the call waited", async () => {
			const api = await open();
			expect(await api.probe.now(entry)).toEqual(inCall(api.slothlet.instance.id));
			expect(await api.probe.later(entry)).toEqual(inCall(api.slothlet.instance.id));
		});

		it("names each instance in its own call with two instances, overlapping or not", async () => {
			const a = await open();
			const b = await open();
			expect(await a.probe.now(entry)).toEqual(inCall(a.slothlet.instance.id));
			expect(await b.probe.now(entry)).toEqual(inCall(b.slothlet.instance.id));
			const [fromA, fromB] = await Promise.all([a.probe.later(entry), b.probe.later(entry)]);
			expect(fromA).toEqual(inCall(a.slothlet.instance.id));
			expect(fromB).toEqual(inCall(b.slothlet.instance.id));
		});

		it("names the run() store inside a run(), in a call and in the host's callback", async () => {
			const api = await open();
			const inRun = await api.slothlet.context.run({ tag: "x" }, () => api.probe.now(entry));
			expect(inRun.id.startsWith(`${api.slothlet.instance.id}__run_`)).toBe(true);
			expect(inRun).toEqual(inCall(inRun.id));
			const hostInRun = await api.slothlet.context.run({ tag: "x" }, () => hostRead(entry));
			expect(hostInRun.id.startsWith(`${api.slothlet.instance.id}__run_`)).toBe(true);
			expect(hostInRun).toEqual(inCall(hostInRun.id));
		});

		it("reads as nothing in the host's own code outside any call, before and after calls", async () => {
			const api = await open();
			expect(hostRead(entry)).toEqual(OUTSIDE);
			await api.probe.later(entry);
			expect(hostRead(entry)).toEqual(OUTSIDE);
		});
	});

	it("the live entry reads as nothing where no live instance runs", async () => {
		const api = await open();
		await api.probe.later(runtime);
		if (runtime === "async") expect(hostRead("live")).toEqual(OUTSIDE);
		await api.shutdown();
		apis.length = 0;
		expect(hostRead("live")).toEqual(OUTSIDE);
		expect(hostRead("auto")).toEqual(OUTSIDE);
	});
});
