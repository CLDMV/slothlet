/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/helpers/rows.mjs
 *	@Date: 2026-11-15T12:30:13-08:00 (1794774613)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:16:01-08:00 (1794777361)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Turn the shared rows of a `tests/browser/cases/` module into vitest tests.
 *
 * @description
 * A row runs against an environment and returns its checks as `[label, actual, expected]` triples; the actual and the
 * expected values are plain data, so the same rows can be run and compared outside the test runner too.
 * @module tests/browser/helpers/rows
 */

/**
 * The configs of the mode / runtime / attribution matrix.
 * @param {{modes?: string[], runtimes?: string[], attributions?: string[]}} [axes] - The values of each axis.
 * @returns {Array<{mode: string, runtime: string, attribution: string, name: string}>} The configs.
 */
export function matrix({ modes = ["eager", "lazy"], runtimes = ["async", "live"], attributions = ["precise", "fast"] } = {}) {
	return modes.flatMap((mode) =>
		runtimes.flatMap((runtime) =>
			attributions.map((attribution) => ({ mode, runtime, attribution, name: `${mode} / ${runtime} / ${attribution}` }))
		)
	);
}

/**
 * Run a check and give back what it answered, or the code it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw: code }`.
 */
export function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * Await a check and give back what it settled to, or the code it was refused with.
 * @param {function(): *} check - The check.
 * @returns {Promise<*>} Its answer, or `{ threw: code }`.
 */
export async function settled(check) {
	try {
		return await check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * Define one vitest test per row and config.
 * @param {{describe: Function, it: Function, expect: Function}} vitest - The vitest functions.
 * @param {string} title - The suite's title.
 * @param {Array<{title: string, configs: object[], run: Function}>} rows - The rows.
 * @param {object} env - The environment the rows run in.
 * @returns {void}
 */
export function defineRows({ describe, it, expect }, title, rows, env) {
	describe(title, () => {
		for (const row of rows) {
			describe.each(row.configs)("$name", (config) => {
				it(row.title, async () => {
					const checks = await row.run(env, config);
					expect(checks.length).toBeGreaterThan(0);
					for (const [label, actual, expected] of checks) expect(actual, label).toEqual(expected);
				});
			});
		}
	});
}
