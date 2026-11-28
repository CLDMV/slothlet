/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/reload-add-in-flight.test.vitest.mjs
 *	@Date: 2026-11-22T12:00:00-08:00 (1795377600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:37-08:00 (1795869097)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An `api.add()` that is still loading when a full `reload()` finishes stays mounted across later
 * reloads, as an add that resolved before or while the reload built does (docs/RELOAD.md).
 *
 * @description
 * Fixture (written at run time): `api/calls/calls.mjs` exports `copyOf()`; `slow/slow.mjs` awaits
 * `globalThis[GATE]` at top level when it is set, then exports `hi()`. The add starts right after the reload, and the
 * gate opens only once the reload has finished, so the add resolves after the reload's swap. The reference is the same
 * add made with no reload under way.
 * @module tests/vitests/suites/core/reload-add-in-flight
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "reload-add-in-flight");
const BASE = path.join(ROOT, "api");
const SLOW = path.join(ROOT, "slow");
const GATE = Symbol.for("slothlet.test.reload-add-in-flight.gate");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(SLOW, { recursive: true });
	writeFileSync(path.join(BASE, "calls", "calls.mjs"), 'export function copyOf() {\n\treturn "calls";\n}\n');
	writeFileSync(
		path.join(SLOW, "slow.mjs"),
		[
			'const gate = globalThis[Symbol.for("slothlet.test.reload-add-in-flight.gate")];',
			"if (gate) await gate;",
			"export function hi() {",
			'\treturn "hi";',
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * What a call answers: its value, or the code of the error it throws.
 * @param {Function} fn - The call.
 * @returns {Promise<*>} The value or the error code.
 */
async function outcome(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message);
	}
}

const configs = ["async", "live"].flatMap((runtime) => ["eager", "lazy"].map((mode) => ({ runtime, mode })));

describe.each(configs)("an add still loading when a full reload finishes > $runtime / $mode", ({ runtime, mode }) => {
	let api;

	afterEach(async () => {
		delete globalThis[GATE];
		await api?.slothlet.shutdown();
		api = null;
	});

	it("stays mounted across the reloads after it", async () => {
		api = await slothlet({ base: BASE, runtime, mode, silent: true });
		let release;
		globalThis[GATE] = new Promise((resolve) => (release = resolve));
		const reloading = api.slothlet.reload();
		const adding = api.slothlet.api.add("slow", SLOW, { id: "slow" });
		await reloading;
		release();
		await adding;
		delete globalThis[GATE];
		expect(await outcome(() => api.slow.hi())).toBe("hi");

		await api.slothlet.reload();
		expect(await outcome(() => api.slow.hi())).toBe("hi");
		await api.slothlet.reload();
		expect(await outcome(() => api.slow.hi())).toBe("hi");
		expect(await outcome(() => api.calls.copyOf())).toBe("calls");
	});

	it("is recorded once, so a remove after the reloads takes it away for good", async () => {
		api = await slothlet({ base: BASE, runtime, mode, silent: true });
		let release;
		globalThis[GATE] = new Promise((resolve) => (release = resolve));
		const reloading = api.slothlet.reload();
		const adding = api.slothlet.api.add("slow", SLOW, { id: "slow" });
		await reloading;
		release();
		await adding;
		delete globalThis[GATE];

		await api.slothlet.reload();
		await api.slothlet.api.remove("slow");
		expect(api.slow).toBeUndefined();
		await api.slothlet.reload();
		expect(api.slow).toBeUndefined();
		expect(await outcome(() => api.calls.copyOf())).toBe("calls");
	});
});
