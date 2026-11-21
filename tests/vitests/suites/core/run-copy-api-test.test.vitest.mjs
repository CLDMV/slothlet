/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-copy-api-test.test.vitest.mjs
 *	@Date: 2026-11-18T06:02:30-08:00 (1795010550)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T06:10:31-08:00 (1795011031)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.api.add()` inside a run on the main `api_test` fixture. The run's first change builds a copy
 * of the instance's tree from the modules that tree already uses; `api_test` has a file and a folder of the same name
 * (`math.mjs` beside `math/math.mjs`), whose merge must not leave nodes of the instance's tree in a module's export for
 * the copy to read. The expected values come from a reference instance that made the same add outside any run.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const STRING_DIR = path.join(TEST_DIRS.API_TEST, "string");

/**
 * What the counts look like with no run live and no copy held.
 * @type {{runs: number, held: number, readThrough: number}}
 */
const BASELINE = { runs: 0, held: 0, readThrough: 0 };

/**
 * Let a few macrotasks pass: a run's copy is torn down on one once the run's work has finished.
 * @returns {Promise<void>}
 */
async function idle() {
	for (let index = 0; index < 4; index++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * The values the test compares, read from an api tree.
 * @param {object} api - The api (or the run's view of it).
 * @returns {Promise<object>} The values (a lazy node's first call answers with a promise, so each one is awaited).
 */
async function readValues(api) {
	return {
		mathAdd: await api.math.add(2, 3),
		mathMultiply: await api.math.multiply(2, 3),
		mathCollision: await api.math.collisionVersion,
		rootMathAdd: await api.rootMath.add(2, 3),
		extraUpper: api.extra === undefined ? undefined : await api.extra.string.upper("abc"),
		extraReverse: api.extra === undefined ? undefined : await api.extra.string.reverse("abc")
	};
}

describe.each([["async"], ["live"]])("api.add() inside a run on api_test — %s runtime", (runtime) => {
	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		/**
		 * Make an instance on the api_test fixture.
		 * @returns {Promise<object>} The api.
		 */
		function make() {
			return slothlet({ base: TEST_DIRS.API_TEST, runtime, mode, silent: true });
		}

		it("the run's tree answers as an instance that made the add outside any run, and the instance never sees it", async () => {
			const reference = await make();
			let expected;
			let instanceBefore;
			try {
				await reference.slothlet.api.add("extra", STRING_DIR, { id: "extra" });
				expected = await readValues(reference);
			} finally {
				await reference.slothlet.shutdown();
			}
			expect(expected.extraUpper).toBe("ABC");

			const api = await make();
			try {
				instanceBefore = await readValues(api);
				const inside = await api.slothlet.context.run({ user: "r" }, async () => {
					await api.slothlet.api.add("extra", STRING_DIR, { id: "extra" });
					return await readValues(api);
				});
				expect(inside).toEqual(expected);
				await idle();
				expect(await readValues(api)).toEqual(instanceBefore);
				expect(api.extra).toBeUndefined();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("adding the whole fixture inside a run mounts it as an instance adding it outside a run does", async () => {
			const reference = await make();
			let expected;
			try {
				await reference.slothlet.api.add("again", TEST_DIRS.API_TEST, { id: "again" });
				expected = { mathAdd: await reference.again.math.add(2, 3), stringUpper: await reference.again.string.upper("x") };
			} finally {
				await reference.slothlet.shutdown();
			}

			const api = await make();
			try {
				const inside = await api.slothlet.context.run({ user: "r" }, async () => {
					await api.slothlet.api.add("again", TEST_DIRS.API_TEST, { id: "again" });
					return { mathAdd: await api.again.math.add(2, 3), stringUpper: await api.again.string.upper("x") };
				});
				expect(inside).toEqual(expected);
				await idle();
				expect(api.again).toBeUndefined();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
