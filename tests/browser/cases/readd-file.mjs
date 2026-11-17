/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/cases/readd-file.mjs
 *	@Date: 2026-11-15T17:09:19-08:00 (1794791359)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T18:46:54-08:00 (1794797214)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rows: a single file removed and then added again under the same moduleID is imported fresh, so its top
 * level runs again, as a new import of the file does (#793, #805).
 *
 * @description
 * `one.mjs` counts the runs of its top level on `globalThis.__readdBrowser.one` and answers which run its copy is
 * (`ping()`) and the URL it was imported from (`where()`). Eager and lazy mode, the async and live runtime.
 * @module tests/browser/cases/readd-file
 */

import { matrix } from "../helpers/rows.mjs";

const FIXTURE = "api_tests/api_test_browser_readd";

const configs = matrix({ attributions: ["precise"] }).map(({ mode, runtime }) => ({ mode, runtime, name: `${mode} / ${runtime}` }));

/**
 * How many times the file's top level has run.
 * @returns {number} The runs.
 */
const runs = () => globalThis.__readdBrowser?.one ?? 0;

/**
 * Whether a URL carries a reload stamp.
 * @param {string} href - The URL.
 * @returns {boolean} Whether it has `_reload`.
 */
const stamped = (href) => new URL(href).searchParams.has("_reload");

export const rows = ["moduleID", "path"].map((by) => ({
	title: `imports a file removed by its ${by} again when it is added again under the same moduleID`,
	configs,
	async run(env, { mode, runtime }) {
		globalThis.__readdBrowser = {};
		const api = await env.compose({ fixture: FIXTURE, root: "root", files: ["base.mjs"], options: { mode, runtime, diagnostics: true } });
		try {
			const target = env.mountTarget(api, { from: "one.mjs" });
			await api.slothlet.api.add("one", target, { id: "one-mod" });
			const first = await api.one.ping();
			const firstRuns = runs();
			const firstUrl = await api.one.where();
			const removed = await api.slothlet.api.remove(by === "moduleID" ? "one-mod" : "one");
			await api.slothlet.api.add("one", target, { id: "one-mod" });
			return [
				["the first add runs the top level once", [first, firstRuns], [1, 1]],
				["the first add is imported with no reload stamp", stamped(firstUrl), false],
				["the remove", removed, true],
				["the re-add runs the top level again", [await api.one.ping(), runs()], [2, 2]],
				["the re-add is imported from another URL", (await api.one.where()) !== firstUrl, true],
				["the re-add is imported with a reload stamp", stamped(await api.one.where()), true],
				["the re-add owns its path", [...api.slothlet.diag.owner.get("one")].includes("one-mod"), true]
			];
		} finally {
			await api.shutdown();
		}
	}
}));
