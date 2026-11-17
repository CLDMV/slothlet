/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-scheduler-reinstate.test.vitest.mjs
 *	@Date: 2026-11-17T15:19:22-08:00 (1794957562)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T15:24:41-08:00 (1794957881)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A scheduler written back with the function the live patch wraps gets the patch back.
 *
 * @description
 * Code that read `process.nextTick` before slothlet patched it and later writes that value back (vitest does it around
 * the messages its worker sends) takes the patch out. The live runtime puts its wrapper back where a flow or a module
 * call starts, so a callback scheduled there still runs in its own `run()` and as its own module. A function that is not
 * the one under the wrapper (fake timers, another library's wrapper) owns the slot and is left in place.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "context-live-scheduler-reinstate");
const LAYERS = Symbol.for("slothlet.boundaryPatch.layers");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "api", "probe"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "api", "probe", "probe.mjs"),
		[
			'import { self, context } from "@cldmv/slothlet/runtime";',
			"export function noop() {}",
			"export function tick() {",
			"\treturn new Promise((resolve) => process.nextTick(() => resolve(self.probe.who())));",
			"}",
			"export function who() {",
			"\tconst found = self.slothlet.metadata.caller();",
			'\tconst at = found ? (found.apiPath ?? (Array.isArray(found.path) ? found.path.join(".") : "?")) : null;',
			"\treturn { tag: context.tag ?? null, caller: at };",
			"}"
		].join("\n") + "\n"
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe("live runtime: a scheduler written back over the patch", () => {
	let api;

	beforeAll(async () => {
		api = await slothlet({ base: path.join(ROOT, "api"), runtime: "live", mode: "eager", silent: true, context: { tag: "base" } });
	});

	afterAll(async () => {
		await api?.shutdown();
		api = null;
	});

	/**
	 * The patch's wrapper on `process.nextTick` and the function under it.
	 * @returns {Promise<{wrapper: Function, below: Function}>} Both.
	 */
	async function patchedNextTick() {
		// A module call puts the wrapper back if the test runner has written over it already.
		await api.probe.noop();
		const wrapper = process.nextTick;
		const below = globalThis[LAYERS].get(wrapper)?.below;
		expect(typeof below).toBe("function");
		return { wrapper, below };
	}

	it("a stale write-back is undone where the next flow starts", async () => {
		const { wrapper, below } = await patchedNextTick();
		process.nextTick = below;
		const seen = await Promise.all([
			api.slothlet.context.run({ tag: "one" }, () => api.probe.tick()),
			api.slothlet.context.run({ tag: "two" }, () => api.probe.tick())
		]);
		expect(process.nextTick).toBe(wrapper);
		expect(seen).toEqual([
			{ tag: "one", caller: "probe.tick" },
			{ tag: "two", caller: "probe.tick" }
		]);
	});

	it("a function of someone else's is left in place", async () => {
		const { wrapper } = await patchedNextTick();
		const own = function nextTick(...args) {
			return Reflect.apply(wrapper, process, args);
		};
		process.nextTick = own;
		try {
			await api.slothlet.context.run({ tag: "one" }, () => api.probe.noop());
			expect(process.nextTick).toBe(own);
		} finally {
			process.nextTick = wrapper;
		}
	});
});
