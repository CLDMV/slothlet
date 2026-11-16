/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-node-type-read.test.vitest.mjs
 *	@Date: 2026-11-15T10:33:27-08:00 (1794767607)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:53:14-08:00 (1794775994)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module reading a node's `__type` through `self` is answered as the host is when no rule refuses it,
 * and refused when a rule denies it the node, in eager and lazy mode alike.
 *
 * @description
 * `__type` is what a node reports about itself, not a member of the module, so it is decided as a read of the node's
 * own path: the name `__type` is never taken for a module-private member. The expected type is the host's answer on an
 * eager instance. Lazy rows read the node once its folder has loaded, and through a node kept from before the load.
 * @module tests/vitests/suites/permissions/permissions-node-type-read
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_node_type_read");

const PATHS = ["d", "d.fn", "d.data", "d.sub", "d.sub.leaf"];

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Read a node by its dotted path.
 * @param {object} api - The api.
 * @param {string} path - The path.
 * @returns {*} The node.
 */
const at = (api, path) => path.split(".").reduce((node, key) => node[key], api);

/**
 * Load every folder of the fixture.
 * @param {object} api - The api.
 * @returns {Promise<void>}
 */
const loadAll = async (api) => {
	for (const path of PATHS) await at(api, path);
};

/** The host's `__type` of each node on an eager instance. */
const expected = {};

beforeAll(async () => {
	const api = await slothlet({ base: FIXTURE, mode: "eager", silent: true });
	for (const path of PATHS) expected[path] = at(api, path).__type;
	await api.shutdown();
});

describe.each(configs)("a module's read of a node's __type > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Load the fixture.
	 * @param {object} [permissions] - Permission settings over the row's attribution.
	 * @returns {Promise<object>} The api.
	 */
	const load = async (permissions = {}) => {
		api = await slothlet({
			base: FIXTURE,
			mode,
			runtime,
			silent: true,
			permissions: { attribution, defaultPolicy: "allow", rules: [], ...permissions }
		});
		return api;
	};

	it.each(PATHS)("is answered as the host is with no rules: %s", async (path) => {
		await load();
		await loadAll(api);
		expect(api.reader.type(path)).toBe(expected[path]);
		expect(at(api, path).__type).toBe(expected[path]);
	});

	it.each(PATHS)("is answered with a deny on another node: %s", async (path) => {
		await load({ rules: [{ caller: "reader.**", target: "elsewhere.**", effect: "deny" }] });
		await loadAll(api);
		expect(api.reader.type(path)).toBe(expected[path]);
	});

	it.each(PATHS)("is refused under a deny on the node's path, and still answered to the host: %s", async (path) => {
		await load({ rules: [{ caller: "reader.**", target: path, effect: "deny" }] });
		await loadAll(api);
		expect(api.reader.type(path)).toEqual({ threw: "PERMISSION_DENIED" });
		expect(at(api, path).__type).toBe(expected[path]);
	});

	it.each(PATHS)("is refused under a default deny, and answered with an allow on the node's path: %s", async (path) => {
		await load({ defaultPolicy: "deny", rules: [{ caller: "reader.**", target: "reader.**", effect: "allow" }] });
		await loadAll(api);
		expect(api.reader.type(path)).toEqual({ threw: "PERMISSION_DENIED" });
		await api.shutdown();
		await load({
			defaultPolicy: "deny",
			rules: [
				{ caller: "reader.**", target: "reader.**", effect: "allow" },
				{ caller: "reader.**", target: path, effect: "allow" }
			]
		});
		await loadAll(api);
		expect(api.reader.type(path)).toBe(expected[path]);
	});

	it.each(PATHS)("on a node kept before its folder loaded, is answered once loaded, and refused under a deny: %s", async (path) => {
		await load();
		api.reader.take(path);
		await loadAll(api);
		expect(api.reader.type(path, true)).toBe(expected[path]);
		await api.shutdown();
		await load({ rules: [{ caller: "reader.**", target: path, effect: "deny" }] });
		api.reader.take(path);
		expect(api.reader.type(path, true)).toEqual({ threw: "PERMISSION_DENIED" });
		await loadAll(api);
		expect(api.reader.type(path, true)).toEqual({ threw: "PERMISSION_DENIED" });
	});
});
