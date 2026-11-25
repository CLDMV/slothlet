/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/scope-full-isolation-own-tree-shape.test.vitest.mjs
 *	@Date: 2026-11-18T00:00:00-08:00 (1794988800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:08:04-08:00 (1795536484)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Once a full-isolation run has a tree of its own, setting a node's prototype or closing it
 * (`preventExtensions`, `seal`, `freeze`) changes the node in the run's tree only: the run's tree is built from the
 * modules the instance uses, and the instance's node, and the module's own object behind it, stay as they were.
 *
 * @description
 * The host gives the run a tree of its own (`api.slothlet.api.add()` inside the run), then module code (`prober`) makes
 * one change to the victim's `conf` node through `self` and reads it back; the host's own code does the same through the
 * run's `api`. Each answers as the same change on a plain-JS copy of the object (the reference), with permissions off
 * and on with a host write grant, and the instance's `conf` is unchanged afterwards.
 *
 * Fixture: `api_tests/api_test_self_write_reach/api` and `api_test_self_write_reach_{victim,holder}/api` and `api_tests/api_test_run_prototype_writes/prober`.
 */
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, apiPart } from "../../setup/vitest-helper.mjs";
import { shapeOpOn } from "../../../../api_tests/api_test_run_prototype_writes/prober/p.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const PROBER = path.resolve(FIXTURE, "..", "api_test_run_prototype_writes", "prober");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const GRANT = [
	{ caller: "prober.**", target: "victim.**:write", effect: "allow" },
	{ caller: "prober.**", target: "victim:write", effect: "allow" }
];

const OPS = ["setPrototypeOf", "preventExtensions", "seal", "freeze"];

/**
 * A plain-JS copy of the victim's `conf`.
 * @returns {object} The object.
 */
function plainConf() {
	return {
		get level() {
			return 1;
		}
	};
}

/**
 * Expect the instance's `conf` to be as the victim made it.
 * @param {object} api - The api.
 * @returns {void}
 */
function expectHostUnchanged(api) {
	const conf = api.victim.v.conf;
	expect(Object.getPrototypeOf(conf)).toBe(Object.prototype);
	expect(Object.isExtensible(conf)).toBe(true);
	expect(Object.isSealed(conf)).toBe(false);
	expect(conf.level).toBe(1);
	expect(conf.tag).toBeUndefined();
	expect(Object.getOwnPropertyDescriptor(conf, "level").configurable).toBe(true);
}

describe.each(CONFIGS)("full-isolation run with a tree of its own: node shape changes — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim` and `prober`.
	 * @param {object} options - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options) {
		api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", apiPart(FIXTURE, "victim"), { id: "victim" });
		await api.slothlet.api.add("prober", PROBER, { id: "prober" });
		return api;
	}

	/**
	 * Run `fn` in a full-isolation run that has first been given a tree of its own.
	 * @param {function(): *} fn - The code.
	 * @returns {Promise<*>} What it returned.
	 */
	function inOwnTree(fn) {
		return api.slothlet.context.run({}, async () => {
			await api.slothlet.api.add("extra", apiPart(FIXTURE, "holder"), { id: "extra" });
			return fn();
		});
	}

	describe.each([
		["permissions off", {}],
		["permissions on, a host write grant", { permissions: { rules: GRANT } }]
	])("%s", (_label, options) => {
		it.each(OPS)("%s by module code through self stays in the run's tree", async (how) => {
			await load(options);
			const seen = await inOwnTree(() => api.prober.p.shapeOp(how));
			expect(seen).toEqual(shapeOpOn(plainConf(), how));
			expectHostUnchanged(api);
		});

		it.each(OPS)("%s by the host's code through the run's api stays in the run's tree", async (how) => {
			await load(options);
			const seen = await inOwnTree(() => shapeOpOn(api.victim.v.conf, how));
			expect(seen).toEqual(shapeOpOn(plainConf(), how));
			expectHostUnchanged(api);
		});
	});
});
