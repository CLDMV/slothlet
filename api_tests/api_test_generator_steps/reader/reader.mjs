/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_generator_steps/reader/reader.mjs
 *	@Date: 2026-11-13T01:09:46-08:00 (1794560986)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T07:21:17-08:00 (1794583277)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that steps through another module's generators.
 * @module api_test_generator_steps/reader
 */

import { types } from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Describe a step's result: whether it is a view, its keys and prototype, and what it holds.
 * @param {*} result - The result.
 * @returns {object} The description.
 */
const describeStep = (result) => ({
	view: types.isProxy(result),
	keys: Object.keys(result),
	plain: Object.getPrototypeOf(result) === Object.prototype,
	done: result.done,
	value: typeof result.value === "object" ? { n: result.value.n } : result.value,
	valueViewed: types.isProxy(result.value)
});

/**
 * Plant a method on the prototype of the instance a step handed over.
 * @param {object} instance - The instance.
 * @returns {string} `"written"`, or the code of what refused it.
 */
const plant = (instance) => {
	try {
		Object.getPrototypeOf(instance).__planted = () => "planted";
		return "written";
	} catch (error) {
		return error?.code ?? String(error);
	}
};

/**
 * Step through the owner's generator.
 * @returns {{steps: object[], write: string, spread: number[]}} Each step, how planting through the yielded instance went,
 *   and what spreading a fresh generator gives.
 */
export const stepSync = () => {
	const generator = self.owner.steps();
	const results = [generator.next(), generator.next(), generator.next(), generator.next()];
	return {
		steps: results.map(describeStep),
		write: plant(results[1].value),
		spread: [...self.owner.steps()].map((value) => (typeof value === "object" ? value.n : value))
	};
};

/**
 * Step through the owner's async generator.
 * @returns {Promise<{steps: object[], write: string, iterated: number[]}>} Each step, how planting through the yielded
 *   instance went, and what `for await` over a fresh generator gives.
 */
export const stepAsync = async () => {
	const generator = self.owner.asyncSteps();
	const results = [await generator.next(), await generator.next(), await generator.next(), await generator.next()];
	const iterated = [];
	for await (const value of self.owner.asyncSteps()) iterated.push(typeof value === "object" ? value.n : value);
	return { steps: results.map(describeStep), write: plant(results[1].value), iterated };
};
