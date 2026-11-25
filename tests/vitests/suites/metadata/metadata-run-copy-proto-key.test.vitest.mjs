/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-run-copy-proto-key.test.vitest.mjs
 *	@Date: 2026-11-22T18:00:00-08:00 (1795399200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T18:00:00-08:00 (1795399200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A run's copy of user metadata keeps an own `__proto__` key of a nested value as an own key.
 *
 * @description
 * A run that writes metadata works on a copy of the instance's user metadata. A nested plain object (inside an array,
 * or given an own `__proto__` key after it was stored) can carry an own key named `__proto__`, as `JSON.parse` makes.
 * Copied by assignment, that key set the copy's prototype instead: the run read an inherited `polluted` that the
 * instance does not have, and lost the key. The copy has to hold the same own keys and the same prototype.
 */

import { describe, it, expect, afterEach } from "vitest";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * The shape of a metadata value as code sees it.
 * @param {object} value - The value.
 * @returns {{ protoIsObject: boolean, polluted: *, own: string[], nested: * }} Its shape.
 */
function shapeOf(value) {
	return {
		protoIsObject: Object.getPrototypeOf(value) === Object.prototype,
		polluted: value.polluted,
		own: Object.keys(value),
		nested: Object.getOwnPropertyDescriptor(value, "__proto__")?.value
	};
}

describe.each([
	{ runtime: "async", mode: "eager" },
	{ runtime: "live", mode: "eager" },
	{ runtime: "async", mode: "lazy" },
	{ runtime: "live", mode: "lazy" }
])("Metadata run copy > own __proto__ key > $runtime/$mode", (config) => {
	let api;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	/**
	 * Store `store()`'s value, then read it outside and inside a run that forks the metadata.
	 * @param {Function} store - Stores the value.
	 * @param {Function} pick - Picks the object to inspect from the node's metadata.
	 * @returns {Promise<{ outside: object, inside: object }>} Both shapes.
	 */
	async function readBoth(store, pick) {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
		await api.math.add(1, 2);
		store();
		const outside = shapeOf(pick(api.slothlet.metadata.get(api.math.add)));
		const inside = await api.slothlet.context.run({}, () => {
			api.slothlet.metadata.global("tag", "run");
			return shapeOf(pick(api.slothlet.metadata.get(api.math.add)));
		});
		return { outside, inside };
	}

	it("a nested object in an array", async () => {
		const { outside, inside } = await readBoth(
			() => api.slothlet.metadata.set(api.math.add, "list", [JSON.parse('{"__proto__":{"polluted":true},"a":1}')]),
			(meta) => meta.list[0]
		);
		expect(outside).toEqual({ protoIsObject: true, polluted: undefined, own: ["__proto__", "a"], nested: { polluted: true } });
		expect(inside).toEqual(outside);
	});

	it("a stored value given an own __proto__ key after it was stored", async () => {
		const { outside, inside } = await readBoth(
			() => {
				const value = { a: 1 };
				api.slothlet.metadata.set(api.math.add, "late", value);
				Object.defineProperty(value, "__proto__", { value: { polluted: true }, enumerable: true, configurable: true, writable: true });
			},
			(meta) => meta.late
		);
		expect(outside.own).toContain("__proto__");
		expect(inside).toEqual(outside);
	});
});
