/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-generator-steps.test.vitest.mjs
 *	@Date: 2026-11-13T10:00:00-08:00 (1794592800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T10:00:00-08:00 (1794592800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A step of another module's generator reaches a module as a plain result, under either attribution, with
 * the value in it still held to the owner's rules (#758).
 *
 * @description
 * Plain JavaScript gives a fresh `{ value, done }` object for each step. The expected steps are what the owner's
 * generators give imported as a plain module; the value a step hands over is the owner's, so an instance of the owner's
 * class still reaches the reader as a view and planting a method on its class through it is refused.
 * @module tests/vitests/suites/permissions/crossing-generator-steps
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_generator_steps");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

let twins = 0;

/**
 * Describe a step's result as the reader does, for a result of the plain module's generator.
 * @param {*} result - The result.
 * @param {boolean} valueViewed - Whether the reader is to get the value in it as a view.
 * @returns {object} The description.
 */
const plainStep = (result, valueViewed) => ({
	view: false,
	keys: Object.keys(result),
	plain: Object.getPrototypeOf(result) === Object.prototype,
	done: result.done,
	value: typeof result.value === "object" ? { n: result.value.n } : result.value,
	valueViewed
});

/**
 * What stepping the plain module's generators gives.
 * @returns {Promise<{sync: object[], async: object[], values: number[]}>} The steps, and the values a loop gives.
 */
async function plainSteps() {
	const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-${++twins}`);
	const generator = owner.steps();
	const sync = [generator.next(), generator.next(), generator.next(), generator.next()];
	const asyncGenerator = owner.asyncSteps();
	const asyncResults = [await asyncGenerator.next(), await asyncGenerator.next(), await asyncGenerator.next(), await asyncGenerator.next()];
	// Only the owner's instance is viewed for the reader: numbers and `undefined` are themselves.
	const viewed = (result) => typeof result.value === "object" && result.value !== null;
	return {
		sync: sync.map((result) => plainStep(result, viewed(result))),
		async: asyncResults.map((result) => plainStep(result, viewed(result))),
		values: [...owner.steps()].map((value) => (typeof value === "object" ? value.n : value))
	};
}

describe.each(matrix)("generator steps across modules > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	/**
	 * Build an instance with the owner and the reader mounted as modules of their own.
	 * @returns {Promise<object>} The api.
	 */
	const mount = async () => {
		api = await slothlet({
			base: join(FIXTURE, "host"),
			silent: true,
			mode,
			runtime,
			permissions: { defaultPolicy: "allow", attribution }
		});
		for (const name of ["owner", "reader"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
		for (const node of [api.owner, api.reader]) await node;
		return api;
	};

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("hands each step of a generator over as a plain result, the instance in it still a view held to the owner's rules", async () => {
		const expected = await plainSteps();
		await mount();
		expect(await api.reader.stepSync()).toEqual({ steps: expected.sync, write: "LOOSE_SET_NOT_OWNED", spread: expected.values });
		expect(await api.owner.itemPrototype()).toEqual([]);
	});

	it("hands each step of an async generator over as a plain result, the instance in it still a view held to the owner's rules", async () => {
		const expected = await plainSteps();
		await mount();
		expect(await api.reader.stepAsync()).toEqual({ steps: expected.async, write: "LOOSE_SET_NOT_OWNED", iterated: expected.values });
		expect(await api.owner.itemPrototype()).toEqual([]);
	});
});
