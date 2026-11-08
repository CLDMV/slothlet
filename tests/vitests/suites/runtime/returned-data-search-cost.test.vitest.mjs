/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-data-search-cost.test.vitest.mjs
 *	@Date: 2026-11-08T12:08:42-08:00 (1794168522)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:17:30-08:00 (1794169050)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a call costs for the data around it (#726): a call whose result holds no code reads none of its
 * arguments, and data read through a stand-in is the same object on every read, read once.
 * @description
 * A leaf handed a large argument and returning a primitive or plain data runs in time independent of the argument's
 * size; one returning a function of its own reads the arguments to tell the caller's values apart, so it is the
 * yardstick. A stand-in's data member is handed out as itself on every read, the same object each time (`===`), and
 * a function the module puts into that data afterwards is read through it as the function itself, which runs as
 * whoever calls it (PERMISSIONS.md, "Plain data passes as it is").
 *
 * Expected values come from calling the fixture's own functions directly (plain JavaScript) and from PERMISSIONS.md.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { types } from "node:util";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "returned-data-search-cost");
const API = path.join(ROOT, "api");
const BAG = path.join(API, "bag.mjs");

const BAG_SOURCE = `import { self } from "@cldmv/slothlet/runtime";

export function count(value) {
	return value.rows.length;
}

export function summary(value) {
	return { count: value.rows.length, first: value.rows[0].i };
}

export function closure(value) {
	return () => value.rows.length;
}

let held = null;
export function holder() {
	held = { rows: Array.from({ length: 20000 }, (_, i) => ({ i, tags: [String(i)] })), run: () => self.slothlet.metadata.self()?.apiPath };
	return held;
}

export function plantInRows() {
	held.rows[0].w = () => "planted";
	return 1;
}
`;

/** The plain JavaScript reference. */
let plain;

beforeAll(async () => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(API, { recursive: true });
	writeFileSync(BAG, BAG_SOURCE);
	plain = await import(pathToFileURL(BAG).href);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/** A caller's argument of `count` rows. */
const rowsOf = (count) => ({ rows: Array.from({ length: count }, (_, i) => ({ i, tags: [String(i)], more: { i } })) });

/**
 * The median time of a few calls, in milliseconds.
 * @param {function(): *} call - The call.
 * @param {number} [runs=7] - How many runs.
 * @returns {Promise<number>} The median.
 */
async function median(call, runs = 7) {
	await call();
	const times = [];
	for (let run = 0; run < runs; run++) {
		const start = performance.now();
		await call();
		times.push(performance.now() - start);
	}
	times.sort((a, b) => a - b);
	return times[Math.floor(runs / 2)];
}

describe.each([
	["eager", "async"],
	["eager", "live"],
	["lazy", "async"],
	["lazy", "live"]
])("returned data search cost, %s/%s (#726)", (mode, runtime) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({ base: API, mode, runtime, silent: true });
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it("reads none of a large argument for a call whose result holds no code", async () => {
		const big = rowsOf(100000);
		expect(await api.bag.count(big)).toBe(plain.count(big));
		expect(await api.bag.summary(big)).toEqual(plain.summary(big));
		// A result holding the module's function reads the arguments: the yardstick for what reading them costs.
		const walked = await median(() => api.bag.closure(big));
		const primitive = await median(() => api.bag.count(big));
		const data = await median(() => api.bag.summary(big));
		expect(primitive * 10).toBeLessThan(walked);
		expect(data * 10).toBeLessThan(walked);
	});

	it("hands a stand-in's data member out as the same object on every read", async () => {
		const standIn = await api.bag.holder();
		expect(types.isProxy(standIn)).toBe(true);
		const want = plain.holder();
		expect(want.rows).toBe(want.rows);
		const first = standIn.rows;
		expect(types.isProxy(first)).toBe(false);
		expect(first).toHaveLength(20000);
		for (let read = 0; read < 5; read++) expect(standIn.rows === first).toBe(true);
	});

	it("reads a function the module put into handed-out data afterwards as the function itself", async () => {
		const want = plain.holder();
		plain.plantInRows();
		expect(want.rows[0].w()).toBe("planted");
		const standIn = await api.bag.holder();
		const rows = standIn.rows;
		expect(await api.bag.plantInRows()).toBe(1);
		expect(standIn.rows === rows).toBe(true);
		const fn = standIn.rows[0].w;
		expect(types.isProxy(fn)).toBe(false);
		expect(fn()).toBe("planted");
	});
});
