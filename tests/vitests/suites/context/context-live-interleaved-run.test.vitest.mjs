/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-interleaved-run.test.vitest.mjs
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
 * @fileoverview Calls started in separate `context.run()` flows that pick up again after both `run()`s returned (#763).
 *
 * @description
 * The live runtime keeps the active store in one field, restored in the order things settle. Two `run()` flows whose
 * calls settle after both `run()`s returned could leave that field naming a `run()` store that was already removed, and
 * the next host api call threw `CONTEXT_NOT_FOUND`. A host call made once every `run()` has returned runs with the
 * host's own context, as on the async runtime; a new `run()` gets its own.
 *
 * What the resumed calls themselves see differs by runtime and is documented (CONTEXT-PROPAGATION.md, "Runtime caveat"
 * and "Overlapping calls"): the async runtime gives each call its own flow's context; the live runtime does not isolate
 * interleaved `run()` flows, so each call sees the context of whichever flow the active field names when it picks up:
 * one of the flows, or the instance's own once another flow has returned.
 *
 * Fixture `api_test_live_interleaved_run`: `m.slow` and `n.slow` wait in the exported function, `m.nested` in an unnamed
 * function nested in it; every one reports `context.tag`. The instance's own context is `{ tag: "base" }`.
 * @module tests/vitests/suites/context/context-live-interleaved-run
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_live_interleaved_run");

const matrix = ["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime })));

/**
 * A promise and the function that settles it.
 * @returns {{promise: Promise<void>, release: function(): void}} The gate.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => (release = resolve));
	return { promise, release };
}

describe.each(matrix)("calls of interleaved context.run() flows > $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Build the instance.
	 * @returns {Promise<void>}
	 */
	async function open() {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, context: { tag: "base" } });
	}

	/**
	 * Open a `run()` with a tag.
	 * @param {string} tag - The tag.
	 * @param {function(): *} fn - The callback.
	 * @returns {Promise<*>} What `run()` returned.
	 */
	const run = (tag, fn) => api.slothlet.context.run({ tag }, fn);

	/**
	 * What each resumed call may report: its own flow's context on the async runtime. The live runtime does not
	 * isolate interleaved flows: a call sees the context of whichever flow the active field names when it picks up,
	 * one of the flows, or the instance's own once another flow has returned and restored the field.
	 * @param {string[]} seen - What the calls reported, in start order.
	 * @param {string} prefix - The report's prefix.
	 * @returns {void}
	 */
	function expectFlowContexts(seen, prefix) {
		if (runtime === "async") expect(seen).toEqual([`${prefix}one`, `${prefix}two`]);
		else for (const value of seen) expect([`${prefix}one`, `${prefix}two`, `${prefix}base`]).toContain(value);
	}

	/**
	 * After every `run()` returned, the host's own call sees the host's context, and a new `run()` its own.
	 * @returns {Promise<void>}
	 */
	async function expectHostContext() {
		expect(await api.m.other()).toBe("other:base");
		expect(await run("three", () => api.m.other())).toBe("other:three");
		expect(await api.m.other()).toBe("other:base");
	}

	it("two calls of one export, each in its own run(), awaited together", async () => {
		await open();
		const first = run("one", () => api.m.slow());
		const second = run("two", () => api.m.slow());
		expectFlowContexts(await Promise.all([first, second]), "slow:");
		await expectHostContext();
	});

	it("two calls of one file picking up in an unnamed function, released in start order", async () => {
		await open();
		const [g1, g2] = [gate(), gate()];
		const first = run("one", () => api.m.nested(g1.promise));
		const second = run("two", () => api.m.nested(g2.promise));
		g1.release();
		g2.release();
		expectFlowContexts([await first, await second], "nested:");
		await expectHostContext();
	});

	it("two calls of one file picking up in an unnamed function, released in reverse order", async () => {
		await open();
		const [g1, g2] = [gate(), gate()];
		const first = run("one", () => api.m.nested(g1.promise));
		const second = run("two", () => api.m.nested(g2.promise));
		g2.release();
		g1.release();
		expectFlowContexts([await first, await second], "nested:");
		await expectHostContext();
	});

	it("calls of two files, each in its own run()", async () => {
		await open();
		const [g1, g2] = [gate(), gate()];
		const first = run("one", () => api.m.slow(g1.promise));
		const second = run("two", () => api.n.slow(g2.promise));
		g1.release();
		g2.release();
		const [a, b] = [await first, await second];
		if (runtime === "async") expect([a, b]).toEqual(["slow:one", "n:two"]);
		else {
			expect(["slow:one", "slow:two", "slow:base"]).toContain(a);
			expect(["n:one", "n:two", "n:base"]).toContain(b);
		}
		await expectHostContext();
	});

	it("three interleaved run() flows, settled out of order, leave the host its context", async () => {
		await open();
		const gates = [gate(), gate(), gate()];
		const flows = ["one", "two", "four"].map((tag, index) => run(tag, () => api.m.nested(gates[index].promise)));
		gates[1].release();
		gates[2].release();
		gates[0].release();
		await Promise.all(flows);
		await expectHostContext();
	});
});
