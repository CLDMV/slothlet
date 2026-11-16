/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-instanceid-entries.test.vitest.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T08:00:00-08:00 (1794585600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Both runtimes export the same `instanceID`, and the auto-selecting entry answers through either (#764).
 *
 * @description
 * One expectation table for both runtimes, read through the instance's own runtime entry and through
 * `@cldmv/slothlet/runtime`:
 *
 * | Where it is read                     | `String(instanceID)`                 | `instanceID.length` | `"length" in` |
 * | ------------------------------------ | ------------------------------------ | ------------------- | ------------- |
 * | in a call of instance A (or B)       | A's id (B's id)                      | the id's length     | true          |
 * | after the call waited                | A's id                               | the id's length     | true          |
 * | in a call inside `run()` on A        | the `run()` store's id (`A__run_…`)  | its length          | true          |
 * | in the host's `run()` callback on A  | the `run()` store's id               | its length          | true          |
 * | in the host's code, outside any call | throws `TypeError` (no member reads) | undefined           | false         |
 *
 * A missing member is never `in` it. Fixture `api_test_runtime_instanceid`: `probe.now(entry)` / `probe.later(entry)`
 * read the export of `entry` (`"auto"`, `"async"`, `"live"`) inside the call.
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
const inCall = (id) => ({ text: id, length: id.length, hasLength: true, hasMissing: false });

/**
 * How `instanceID` of one entry reads in the host's own code.
 * @param {string} entry - The entry.
 * @returns {object} The read.
 */
function hostRead(entry) {
	const { instanceID } = ENTRIES[entry];
	let text;
	try {
		text = String(instanceID);
	} catch (error) {
		text = error.name;
	}
	return { text, length: instanceID.length, hasLength: "length" in instanceID, hasMissing: "missing" in instanceID };
}

const OUTSIDE = { text: "TypeError", length: undefined, hasLength: false, hasMissing: false };

describe.each(matrix)("instanceID of each runtime entry > $mode / $runtime", ({ mode, runtime }) => {
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
			expect(await api.probe.now(entry)).toEqual(inCall(api.slothlet.instanceID));
			expect(await api.probe.later(entry)).toEqual(inCall(api.slothlet.instanceID));
		});

		it("names each instance in its own call with two instances, overlapping or not", async () => {
			const a = await open();
			const b = await open();
			expect(await a.probe.now(entry)).toEqual(inCall(a.slothlet.instanceID));
			expect(await b.probe.now(entry)).toEqual(inCall(b.slothlet.instanceID));
			const [fromA, fromB] = await Promise.all([a.probe.later(entry), b.probe.later(entry)]);
			expect(fromA).toEqual(inCall(a.slothlet.instanceID));
			expect(fromB).toEqual(inCall(b.slothlet.instanceID));
		});

		it("names the run() store inside a run(), in a call and in the host's callback", async () => {
			const api = await open();
			const inRun = await api.slothlet.context.run({ tag: "x" }, () => api.probe.now(entry));
			expect(inRun.text.startsWith(`${api.slothlet.instanceID}__run_`)).toBe(true);
			expect(inRun).toEqual(inCall(inRun.text));
			const hostInRun = await api.slothlet.context.run({ tag: "x" }, () => hostRead(entry));
			expect(hostInRun.text.startsWith(`${api.slothlet.instanceID}__run_`)).toBe(true);
			expect(hostInRun).toEqual(inCall(hostInRun.text));
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
