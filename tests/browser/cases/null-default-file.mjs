/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/cases/null-default-file.mjs
 *	@Date: 2026-11-15T17:09:02-08:00 (1794791342)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:48-08:00 (1795869048)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rows: a single file whose default export is `null` or `undefined`, mounted with
 * `api.slothlet.api.add()`, reads as that value by the host and a module (#792, #805).
 *
 * @description
 * The null-default fixture is the api root; `pnull.mjs` is added on its own at `one` and `pundef.mjs` at `deep.one`.
 * The expected values are the files' own default exports, imported plainly. Eager and lazy mode, the async and live
 * runtime, both attributions.
 * @module tests/browser/cases/null-default-file
 */

import { matrix, settled } from "../helpers/rows.mjs";

const FIXTURE = "api_tests/api_test_null_default";
const FILES = ["pnull.mjs", "pundef.mjs", "reader.mjs"];

/** Each single-file add: where it mounts and the file. */
const ADDS = [
	[["one"], "pnull.mjs"],
	[["deep", "one"], "pundef.mjs"]
];

const configs = matrix().map((config) => ({ ...config, permissions: { caller: { attribution: config.attribution }, rules: [] } }));

/**
 * A value as the fixture's reader describes it.
 * @param {*} value - The value.
 * @returns {*} Its description.
 */
function described(value) {
	if (value === undefined) return { undefined: true };
	if (value === null || typeof value !== "object") return typeof value === "function" ? { function: true } : value;
	return { object: true };
}

export const rows = [
	{
		title: "a single file added at a path reads and awaits as the plain module's default export, by the host and a module",
		configs,
		async run(env, config) {
			const api = await env.compose({
				fixture: FIXTURE,
				files: FILES,
				options: { mode: config.mode, runtime: config.runtime, permissions: config.permissions }
			});
			try {
				for (const [at, file] of ADDS) await api.slothlet.api.add(at, env.mountTarget(api, { from: file }));
				await api.reader;
				const checks = [];
				for (const [at, file] of ADDS) {
					const path = at.join(".");
					const plain = described((await env.plain(FIXTURE, file)).default);
					const node = () => at.reduce((holder, key) => holder[key], api);
					checks.push(
						[`the host reads ${path}`, described(node()), plain],
						[`the host awaits ${path}`, described(await node()), plain],
						[`a module reads ${path}`, await settled(() => api.reader.read(path)), plain],
						[`a module awaits ${path}`, await settled(() => api.reader.settle(path)), plain]
					);
				}
				return checks;
			} finally {
				await api.shutdown();
			}
		}
	}
];
