/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-cycles.test.vitest.mjs
 *	@Date: 2026-11-17T07:34:20-08:00 (1794929660)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:40:15-08:00 (1794930015)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Metadata refuses a circular reference through arrays exactly as it does through plain objects,
 * at every entry point: the `metadata` config option, `api.slothlet.api.add` metadata, and
 * `api.slothlet.metadata.global` and `.set` (a function or an api path).
 *
 * @module tests/vitests/suites/metadata/metadata-cycles.test.vitest
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const objectCycle = () => {
	const o = {};
	o.self = o;
	return o;
};
const arrayCycle = () => {
	const l = [1];
	l.push(l);
	return l;
};
// object -> array -> object -> (back to the first object)
const mixedCycle = () => {
	const o = { items: [] };
	o.items.push({ back: o });
	return o;
};
// array -> object -> array -> (back to the first array)
const mixedArrayRoot = () => {
	const l = [];
	l.push({ nested: [l] });
	return l;
};

const cases = {
	"plain object": objectCycle,
	array: arrayCycle,
	"object through an array": mixedCycle,
	"array through an object": mixedArrayRoot
};

describe("metadata cycles", () => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const refused = (fn) => expect(fn).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
	const refusedAsync = (promise) => expect(promise).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });

	describe.each(Object.entries(cases))("%s cycle", (_label, make) => {
		it("is refused by the slothlet() metadata option", async () => {
			await refusedAsync(slothlet({ base: TEST_DIRS.API_TEST, metadata: { value: make() } }));
		});

		it("is refused by api.slothlet.api.add metadata", async () => {
			api = await slothlet({ base: TEST_DIRS.API_TEST });
			await refusedAsync(api.slothlet.api.add("cyc", TEST_DIRS.API_SMART_FLATTEN, { metadata: { value: make() } }));
		});

		it("is refused by api.slothlet.metadata.global", async () => {
			api = await slothlet({ base: TEST_DIRS.API_TEST });
			refused(() => api.slothlet.metadata.global("value", make()));
			refused(() => api.slothlet.metadata.global({ value: make() }));
		});

		it("is refused by api.slothlet.metadata.set on an api path", async () => {
			api = await slothlet({ base: TEST_DIRS.API_TEST });
			refused(() => api.slothlet.metadata.set("math", "value", make()));
			refused(() => api.slothlet.metadata.set("math", { value: make() }));
		});

		it("is refused by api.slothlet.metadata.set on a node", async () => {
			api = await slothlet({ base: TEST_DIRS.API_TEST });
			refused(() => api.slothlet.metadata.set(api.math, "value", make()));
		});
	});

	it("still accepts a shared (non-cyclic) reference through arrays", async () => {
		const shared = [1, 2];
		api = await slothlet({ base: TEST_DIRS.API_TEST, metadata: { a: shared, b: [shared, { again: shared }] } });
		expect(api.slothlet.metadata.global).toBeTypeOf("function");
	});
});
