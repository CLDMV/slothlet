/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-copy-back-to-back.test.vitest.mjs
 *	@Date: 2026-11-21T23:15:52-08:00 (1795331752)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T23:28:10-08:00 (1795332490)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A loop that awaits `run()`s one after another, never letting a macrotask pass, must not keep the copy of
 * every run it finished. A finished run's copy is still torn down after the work that finished it (never in the middle
 * of it), but no longer only once the process is idle: the number of finished runs waiting for their teardown stays
 * bounded however many runs the loop makes. A run that still has work pending keeps its copy through the loop and reads
 * it when that work runs.
 */
import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import { retiringRunCount, runCopyCounts } from "#helpers/flow-stores";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * How many runs each loop makes.
 * @type {number}
 */
const RUNS = 3000;

/**
 * The most finished runs (or held copies) a loop may leave waiting at any point: far below {@link RUNS}.
 * @type {number}
 */
const BOUND = 512;

/**
 * What the counts look like with no run live and no copy held.
 * @type {{runs: number, held: number, readThrough: number}}
 */
const BASELINE = { runs: 0, held: 0, readThrough: 0 };

/**
 * Let a few macrotasks pass.
 * @returns {Promise<void>}
 */
async function idle() {
	for (let index = 0; index < 4; index++) await new Promise((resolve) => setImmediate(resolve));
}

describe.each([["async"], ["live"]])("back-to-back awaited runs keep a bounded number of finished copies — %s runtime", (runtime) => {
	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		/**
		 * Make an instance on the main fixture.
		 * @returns {Promise<object>} The api.
		 */
		function make() {
			return slothlet({ base: TEST_DIRS.API_TEST, runtime, mode, silent: true });
		}

		/**
		 * The global metadata tag the calling code sees.
		 * @param {object} api - The api.
		 * @returns {*} The tag.
		 */
		function tag(api) {
			return api.slothlet.metadata.get(api.math.add).tag ?? null;
		}

		it("runs that change nothing: the finished runs waiting for teardown stay bounded", async () => {
			const api = await make();
			try {
				await idle();
				const start = retiringRunCount();
				let most = 0;
				for (let index = 0; index < RUNS; index++) {
					// The same call outside any run is the reference.
					expect(await api.slothlet.context.run({ index }, () => api.math.add(index, 1))).toBe(api.math.add(index, 1));
					most = Math.max(most, retiringRunCount() - start);
				}
				expect(most).toBeLessThanOrEqual(BOUND);
				await idle();
				expect(retiringRunCount()).toBe(start);
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("runs that fork: the copies held stay bounded, and each run reads its own", async () => {
			const api = await make();
			try {
				await idle();
				let most = 0;
				for (let index = 0; index < RUNS; index++) {
					const seen = await api.slothlet.context.run({}, async () => {
						api.slothlet.metadata.global("tag", index);
						await null;
						return tag(api);
					});
					expect(seen).toBe(index);
					most = Math.max(most, runCopyCounts().held);
				}
				expect(most).toBeLessThanOrEqual(BOUND);
				expect(tag(api)).toBe(null);
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a run with a pending timer keeps its copy through the loop and reads it when the timer fires", async () => {
			const api = await make();
			try {
				await idle();
				let fired;
				const firedValue = new Promise((resolve) => {
					fired = resolve;
				});
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "kept");
					setTimeout(() => fired(tag(api)), 0);
				});
				for (let index = 0; index < RUNS; index++) {
					await api.slothlet.context.run({}, () => {
						api.slothlet.metadata.global("tag", index);
					});
				}
				expect(runCopyCounts().runs).toBe(1);
				expect(await firedValue).toBe("kept");
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a run whose callback leaves a promise reaction reads its own copy in that reaction, inside the loop", async () => {
			const api = await make();
			try {
				await idle();
				const seen = [];
				for (let index = 0; index < RUNS; index++) {
					await api.slothlet.context.run({}, () => {
						api.slothlet.metadata.global("tag", index);
						Promise.resolve().then(() => seen.push(tag(api)));
					});
				}
				await idle();
				expect(seen.length).toBe(RUNS);
				for (let index = 0; index < RUNS; index++) expect(seen[index]).toBe(index);
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
