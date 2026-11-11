/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-guard-plain-js.test.vitest.mjs
 *	@Date: 2026-11-10T20:53:39-08:00 (1794372819)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:29:39-08:00 (1794374979)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Values that cross between modules answer ordinary code as they do in plain JavaScript.
 *
 * @description
 * One battery of ordinary uses of another module's values (a private getter, `instanceof`, a method returning `this`,
 * the same object handed to two functions of a module, a module's own object coming back, subclassing, a `URL`, a
 * `Map`, a `Buffer`, an error, plain data read and written, a promise, a rejection, a closed object its owner changes,
 * `Object.freeze`, `util.inspect`, array methods) is run twice: on the owner's module imported as a plain module, and
 * by the reader through `self.owner`. The answers have to be the same with the permission system off, on with no rule
 * for the reader, and on with the reader granted the owner's subtree, in eager and lazy mode, the async and live
 * runtime, and both `permissions.attribution` values. What does differ while the system is on is asserted on its own:
 * another module's data is one of slothlet's views, so `structuredClone` refuses it.
 * @module tests/vitests/suites/permissions/crossing-guard-plain-js
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_crossing_guard");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];

/** Grants the reader every write in the owner's subtree. */
const ALLOW_READER_WRITES = [
	{ caller: "reader.**", target: "owner.**:write", effect: "allow" },
	{ caller: "reader.**", target: "owner:write", effect: "allow" }
];

const PERMISSIONS = [
	{ name: "permissions off", permissions: null, viewed: false },
	{ name: "on, precise, no rule", permissions: { defaultPolicy: "allow", attribution: "precise" }, viewed: true },
	{ name: "on, fast, no rule", permissions: { defaultPolicy: "allow", attribution: "fast" }, viewed: true },
	{
		name: "on, precise, writes granted",
		permissions: { defaultPolicy: "allow", attribution: "precise", rules: ALLOW_READER_WRITES },
		viewed: false
	},
	{
		name: "on, fast, writes granted",
		permissions: { defaultPolicy: "allow", attribution: "fast", rules: ALLOW_READER_WRITES },
		viewed: false
	}
];

/**
 * Build an instance with the owner and the reader mounted as modules of their own.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { moduleID: "owner" });
	await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
	await api.owner;
	await api.reader;
	return api;
}

/** The battery's answers on the owner's module imported as a plain module: what plain JavaScript gives. */
let plain;

beforeAll(async () => {
	const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin`);
	const reader = await import(`${pathToFileURL(join(FIXTURE, "reader", "reader.mjs")).href}?plain-twin`);
	plain = await reader.battery(owner);
});

const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));

describe.each(matrix)("crossing guard, plain-JS answers > $mode / $runtime / $name", ({ mode, runtime, permissions, viewed }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("gives the reader the answers plain JavaScript gives", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		expect(await api.reader.answers()).toEqual(plain);
	});

	it("hands two functions of one module the same value", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		await api.reader.keep();
		expect(await api.reader.compare()).toBe(true);
	});

	it("shows another module's data as a view only where a write could be refused", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		const shows = await api.reader.shows();
		expect(shows.dataWrapped).toBe(viewed);
		// A view or the object itself, `structuredClone` copies the data.
		expect(shows.cloned).toBe(JSON.stringify({ a: { b: 1 }, list: [1, 2, 3] }));
	});
});
