/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/api-manager/api-manager-reload-collision.test.vitest.mjs
 *	@Date: 2026-11-18T20:37:54-08:00 (1795063074)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:11-08:00 (1795869071)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A reload leaves the api as the adds built it, whatever the collision mode (#904).
 *
 * @description
 * Two adds at the same mount (`features`): `core` (shared.who, shared.coreOnly, math.add), then `extra`
 * (shared.who, shared.extraOnly, other.ping), colliding on `shared` and `shared.who`. Each case snapshots the api
 * after the adds, reloads (the mount path, either module, the base, or the whole instance) and expects the same api
 * back: a reload rebuilds what is there, it does not decide the collisions again a different way.
 *
 * @module tests/vitests/suites/api-manager/api-manager-reload-collision
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURE = path.resolve(TEST_DIRS.API_TEST, "../api_test_add_collision");
const BASE = path.resolve(TEST_DIRS.API_TEST, "../api_test_add_root_base");

const RUNTIME_CONFIGS = [
	{ name: "eager/async", config: { mode: "eager", runtime: "async" } },
	{ name: "eager/live", config: { mode: "eager", runtime: "live" } },
	{ name: "lazy/async", config: { mode: "lazy", runtime: "async" } },
	{ name: "lazy/live", config: { mode: "lazy", runtime: "live" } }
];

const COLLISION_MODES = ["merge", "merge-replace", "replace", "skip", "warn"];

const RELOADS = [
	{ name: 'api.reload("features")', run: (api) => api.slothlet.api.reload("features") },
	{ name: 'api.reload("core")', run: (api) => api.slothlet.api.reload("core") },
	{ name: 'api.reload("extra")', run: (api) => api.slothlet.api.reload("extra") },
	{ name: "api.reload()", run: (api) => api.slothlet.api.reload() },
	{ name: "slothlet.reload()", run: (api) => api.slothlet.reload() }
];

const CASES = RUNTIME_CONFIGS.flatMap(({ name, config }) =>
	COLLISION_MODES.flatMap((mode) =>
		[false, true].map((force) => ({ name: `${name} | ${mode} | force ${force ? "on" : "off"}`, config, mode, force }))
	)
);

/**
 * Describe a node of the api as plain data: its keys, and what each callable returns when called with `(2, 3)`.
 * @param {unknown} node - The api node.
 * @param {number} [depth=0] - How deep the walk is.
 * @returns {Promise<unknown>} The description.
 * @example
 * await describeNode(api.features); // { math: { call: ..., members: { add: { call: 5 } } }, ... }
 */
async function describeNode(node, depth = 0) {
	if (node === null || (typeof node !== "object" && typeof node !== "function")) return { value: node };
	const out = {};
	if (typeof node === "function") {
		try {
			out.call = await node(2, 3);
		} catch (error) {
			out.call = `throws ${error?.code ?? error?.name}`;
		}
	}
	if (depth < 4) {
		const members = {};
		for (const key of Object.keys(node).sort()) {
			members[key] = await describeNode(node[key], depth + 1);
		}
		out.members = members;
	}
	return out;
}

/**
 * Describe `api.features` twice and return the second: the first walk materializes a lazy tree.
 * @param {object} api - The slothlet api.
 * @returns {Promise<unknown>} The description of `api.features`.
 * @example
 * const before = await snapshot(api);
 */
async function snapshot(api) {
	await describeNode(api.features);
	return describeNode(api.features);
}

describe.each(CASES)("reload keeps what the adds built (#904) > $name", ({ config, mode, force }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it.each(RELOADS)("$name", async ({ name, run }) => {
		api = await slothlet({ ...config, base: BASE, silent: true, api: { collision: { mode } } });
		await api.slothlet.api.add("features", path.join(FIXTURE, "core"), { id: "core" });
		await api.slothlet.api.add("features", path.join(FIXTURE, "extra"), { id: "extra", ...(force ? { collision: { force: true } } : {}) });

		const before = await snapshot(api);
		// The adds put both modules' leaves on the mount, so the snapshot is not of an empty api.
		expect(Object.keys(before.members)).toContain("shared");

		// A "skip" / "warn" add that met the mount kept what was there and mounted nothing, so `extra` names neither a
		// module nor a path, and reloading it is refused like any other unknown target.
		const extraMounted = Object.hasOwn(before.members, "other");
		if (name === 'api.reload("extra")' && !extraMounted) {
			await expect(run(api)).rejects.toMatchObject({ code: "API_PATH_NOT_FOUND" });
		} else {
			await run(api);
		}

		expect(await snapshot(api)).toEqual(before);
	});
});
