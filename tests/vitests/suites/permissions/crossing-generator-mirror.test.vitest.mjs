/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-generator-mirror.test.vitest.mjs
 *	@Date: 2026-11-25T07:54:04-08:00 (1795622044)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T08:40:37-08:00 (1795624837)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A generator object a module hands out answers every read, write and close as the generator object
 * itself does in plain JavaScript, however its members change after it was handed out (#965).
 *
 * @description
 * The script in the fixture's `lib/script.mjs` reads each own member's descriptor, `Reflect.ownKeys` order, the
 * frozen / sealed / extensible state and `JSON.stringify` of a generator object a module hands out, writes and deletes
 * members in strict code, and has the module change and close the generator object afterwards: from the generator's
 * own steps, from a call that keeps it in a closure, and from a call it is handed back to. Every answer is compared
 * with the same script run on the fixture's module imported as a plain module, in eager and lazy mode, the async and
 * live runtime, with the permission system on and off, for the host and for another module, for a generator and an
 * async generator.
 * @module tests/vitests/suites/permissions/crossing-generator-mirror
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { script } from "../../../../api_tests/api_test_generator_mirror/lib/script.mjs";

const FIXTURE = resolve("api_tests/api_test_generator_mirror");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => [true, false].map((permissions) => ({ mode, runtime, permissions })))
);

let twins = 0;

/**
 * What the script answers on a fresh copy of the fixture's generator module, imported as a plain module.
 * @param {boolean} isAsync - Whether to take async generators.
 * @returns {Promise<Array<*>>} The answers.
 */
async function plainAnswers(isAsync) {
	const gen = await import(`${pathToFileURL(join(FIXTURE, "api", "gen.mjs")).href}?plain-twin-${++twins}`);
	return script(gen, isAsync);
}

describe.each(matrix)("generator object mirror > $mode / $runtime / permissions $permissions", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.().catch(() => {});
		api = null;
	});

	/**
	 * Build an instance with the generator module and the reader mounted as modules of their own.
	 * @returns {Promise<object>} The api.
	 */
	async function build() {
		api = await slothlet({
			base: join(FIXTURE, "api"),
			mode,
			runtime,
			silent: true,
			...(permissions ? { permissions: { policy: "allow" } } : {})
		});
		await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { id: "reader" });
		for (const node of [api.gen, api.reader]) await node;
		return api;
	}

	for (const isAsync of [false, true]) {
		const kind = isAsync ? "an async generator" : "a generator";

		it(`hands the host ${kind} that answers as plain JS does`, async () => {
			const expected = await plainAnswers(isAsync);
			await build();
			const actual = await script(api.gen, isAsync);
			for (let line = 0; line < expected.length; line++) expect({ line, answer: actual[line] }).toEqual({ line, answer: expected[line] });
			expect(actual.length).toBe(expected.length);
		});

		it(`hands another module ${kind} that answers as plain JS does`, async () => {
			const expected = await plainAnswers(isAsync);
			await build();
			const actual = await api.reader.run(isAsync);
			for (let line = 0; line < expected.length; line++) expect({ line, answer: actual[line] }).toEqual({ line, answer: expected[line] });
			expect(actual.length).toBe(expected.length);
		});
	}
});
