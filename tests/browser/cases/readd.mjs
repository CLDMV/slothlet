/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/cases/readd.mjs
 *	@Date: 2026-11-15T12:33:56-08:00 (1794774836)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:49-08:00 (1795869049)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rows: a module removed and then added again under the same moduleID is imported fresh, so its top
 * level runs again, as a new import of the file does (#793).
 *
 * @description
 * Each file of the fixture counts the runs of its top level on `globalThis.__readdBrowser` and answers which run its
 * copy is (`ping()`) and the URL it was imported from (`where()`). A first add is imported once with no reload stamp;
 * a re-add after a remove is imported again; an add while the same moduleID is still mounted elsewhere shares that live
 * module, as an already-loaded module is the same instance for every importer. Eager and lazy mode, the async and live
 * runtime.
 * @module tests/browser/cases/readd
 */

import { matrix } from "../helpers/rows.mjs";

const FIXTURE = "api_tests/api_test_browser_readd";

const configs = matrix({ attributions: ["precise"] }).map(({ mode, runtime }) => ({ mode, runtime, name: `${mode} / ${runtime}` }));

/**
 * How many times a file's top level has run.
 * @param {string} counter - The file's counter.
 * @returns {number} The runs.
 */
const runs = (counter) => globalThis.__readdBrowser?.[counter] ?? 0;

/**
 * Whether a URL carries a reload stamp.
 * @param {string} href - The URL.
 * @returns {boolean} Whether it has `_reload`.
 */
const stamped = (href) => new URL(href).searchParams.has("_reload");

/**
 * Build an instance over the fixture's `root` folder, with the run counters cleared.
 * @param {object} env - The environment.
 * @param {object} config - The row's config.
 * @returns {Promise<object>} The api.
 */
async function setup(env, { mode, runtime }) {
	globalThis.__readdBrowser = {};
	return env.compose({ fixture: FIXTURE, root: "root", files: ["base.mjs"], options: { mode, runtime, diagnostics: true } });
}

/** The adds re-added after a remove. */
const SHAPES = [{ name: "a folder", at: "plug", from: { from: "plug", files: ["p.mjs"] }, counter: "p", node: (api) => api.plug.p }];

export const rows = [
	...SHAPES.flatMap((shape) =>
		["moduleID", "path"].map((by) => ({
			title: `imports ${shape.name} removed by its ${by} again when it is added again under the same moduleID`,
			configs,
			async run(env, config) {
				const api = await setup(env, config);
				try {
					const target = env.mountTarget(api, shape.from);
					const id = `${shape.at}-mod`;
					await api.slothlet.api.add(shape.at, target, { id });
					const first = await shape.node(api).ping();
					const firstRuns = runs(shape.counter);
					const firstUrl = await shape.node(api).where();
					const removed = await api.slothlet.api.remove(by === "moduleID" ? id : shape.at);
					await api.slothlet.api.add(shape.at, target, { id });
					return [
						["the first add runs the top level once", [first, firstRuns], [1, 1]],
						["the first add is imported with no reload stamp", stamped(firstUrl), false],
						["the remove", removed, true],
						["the re-add runs the top level again", [await shape.node(api).ping(), runs(shape.counter)], [2, 2]],
						["the re-add is imported from another URL", (await shape.node(api).where()) !== firstUrl, true],
						["the re-add is imported with a reload stamp", stamped(await shape.node(api).where()), true],
						["the re-add owns its path", [...api.slothlet.diag.owner.get(shape.at)].includes(id), true]
					];
				} finally {
					await api.shutdown();
				}
			}
		}))
	),
	{
		title: "imports a module again on every re-add, however quickly they follow each other",
		configs,
		async run(env, config) {
			const api = await setup(env, config);
			try {
				const target = env.mountTarget(api, SHAPES[0].from);
				const add = () => api.slothlet.api.add("plug", target, { id: "pm" });
				await add();
				const pings = [await api.plug.p.ping()];
				for (let i = 0; i < 2; i++) {
					await api.slothlet.api.remove("pm");
					await add();
					pings.push(await api.plug.p.ping());
				}
				return [["each re-add is a new run", [pings, runs("p")], [[1, 2, 3], 3]]];
			} finally {
				await api.shutdown();
			}
		}
	},
	{
		title: "does not import again a module whose moduleID still has a live mount",
		configs,
		async run(env, config) {
			const api = await setup(env, config);
			try {
				const target = env.mountTarget(api, SHAPES[0].from);
				await api.slothlet.api.add("a", target, { id: "mm" });
				await api.slothlet.api.add("b", target, { id: "mm" });
				const liveA = await api.a.p.ping();
				const before = runs("p");
				await api.slothlet.api.remove("b");
				await api.slothlet.api.add("b", target, { id: "mm" });
				return [
					["b shares a's module before", liveA, 1],
					["a and b share the live module after", [await api.a.p.ping(), await api.b.p.ping()], [liveA, liveA]],
					["the top level did not run again", runs("p"), before]
				];
			} finally {
				await api.shutdown();
			}
		}
	}
];
