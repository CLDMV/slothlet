/**
 * @fileoverview The platform's cloning functions take another module's data as plain JavaScript does.
 *
 * @description
 * With the permission system on, data one module hands another is a view. `structuredClone`, `v8.serialize` and
 * `postMessage` copy it as they copy the data itself: the answers are those of the same code run on the owner imported
 * as a plain module. The copy is the caller's own and holds nothing of the owner's. The wrappers that make this work
 * are installed once, whatever the number of instances, and are gone when the last instance shuts down.
 * @module tests/vitests/suites/permissions/crossing-clone
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_crossing_rules");
const WATERMARK = Symbol.for("slothlet.clone.original");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		[
			{ name: "permissions off", permissions: null },
			{ name: "precise", permissions: { defaultPolicy: "allow", attribution: "precise" } },
			{ name: "fast", permissions: { defaultPolicy: "allow", attribution: "fast" } }
		].map((entry) => ({ mode, runtime, ...entry }))
	)
);

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

/** The answers on the owner's module imported as a plain module: what plain JavaScript gives. */
let plain;

beforeAll(async () => {
	const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin`);
	const reader = await import(`${pathToFileURL(join(FIXTURE, "reader", "reader.mjs")).href}?plain-twin`);
	plain = await reader.clones(owner);
});

describe.each(matrix)("cloning another module's data > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("copies it as plain JavaScript copies the data itself", async () => {
		api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
		// The twin's own answers are checked first, so a twin that failed to copy cannot pass for the expected value.
		expect(plain).toMatchObject({
			member: '{"b":1}',
			serialize: '{"b":1}',
			posted: '{"theirs":[1,2,3]}',
			withFunction: "threw DataCloneError",
			copyIsPlain: "true"
		});
		expect(await api.reader.clones()).toEqual(plain);
	});
});

describe("cloning another module's data > the wrappers", () => {
	it("are installed once for any number of instances and removed with the last one", async () => {
		expect(globalThis.structuredClone[WATERMARK]).toBeUndefined();
		const first = await mount({ permissions: { defaultPolicy: "allow" } });
		const installed = globalThis.structuredClone;
		expect(typeof installed[WATERMARK]).toBe("function");
		const second = await mount({ permissions: { defaultPolicy: "allow" } });
		expect(globalThis.structuredClone).toBe(installed);
		expect(installed[WATERMARK][WATERMARK]).toBeUndefined();
		await first.shutdown();
		expect(globalThis.structuredClone).toBe(installed);
		await second.shutdown();
		expect(globalThis.structuredClone[WATERMARK]).toBeUndefined();
		expect(structuredClone({ a: 1 })).toEqual({ a: 1 });
	});
});
