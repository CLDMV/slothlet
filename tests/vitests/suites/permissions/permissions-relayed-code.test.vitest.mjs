/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-relayed-code.test.vitest.mjs
 *	@Date: 2026-11-11T11:47:43-08:00 (1794426463)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:14:54-08:00 (1794431694)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Returning a closure lends nothing: a code value a call was handed runs under the call that handed it
 * in as well, whoever defined it. A module denied a target does not reach it by passing a closure an allowed module
 * returned to a leaf that is allowed, directly or through a chain of leaves.
 *
 * @description
 * Fixture `api_test_load_identity`. Rules: everything is denied the vault except `bag`, `runner`, `relay` and the host
 * object leaf `host.records`. `ext` (denied) asks `bag` for closures that read the vault and hands them to the allowed
 * leaves. Expected values come from the rule: the definer, the leaf the code runs inside and every call that handed
 * the code down have to be allowed. `ext` is one of those calls, so each relay is refused. What stays allowed is what
 * lends on purpose: a closure pinned with `self.slothlet.lockCaller()`, a leaf, and a leaf acting on its own with
 * nothing handed in. The host handing the same closure to the same leaf is allowed: the host is no module.
 *
 * Inside a call that was handed code, slothlet cannot tell which function the caller handed in from one the leaf
 * obtained itself, so another module's handed-out code run there is held to the caller too.
 *
 * @module tests/vitests/suites/permissions/permissions-relayed-code
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_load_identity/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";
const RULES = [
	{ caller: "**", target: "vault.**", effect: "deny" },
	{ caller: "bag.**", target: "vault.**", effect: "allow" },
	{ caller: "runner.**", target: "vault.**", effect: "allow" },
	{ caller: "relay.**", target: "vault.**", effect: "allow" },
	{ caller: "host.records.**", target: "vault.**", effect: "allow" }
];

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

describe.each(MATRIX)("Permissions > a closure relayed through an allowed leaf > $name", ({ attribution, mode, runtime }) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules: RULES } });
		await api.slothlet.api.add(["host", "records"], {
			run(fn) {
				return fn();
			}
		});
		// Load every file, so a lazy node answers as an eager one.
		await api.vault.get();
		await api.bag.call(() => 1);
		await api.runner.call(() => 1);
		await api.relay.ping();
		await api.ext.ping();
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it.each([
		["run by the denied module itself", "direct"],
		["run by the denied module through a built-in", "ownMap"],
		["handed to another module's leaf", "runnerCall"],
		["taken out of returned data and handed to another module's leaf", "runnerBoxed"],
		["handed to a leaf that maps with it", "runnerMap"],
		["bound and handed to another module's leaf", "runnerBound"],
		["wrapped in the denied module's own closure", "runnerWrapped"],
		["handed back to a leaf of the module that made it", "bagCall"],
		["bound and handed back to a leaf of the module that made it", "bagBound"],
		["handed down a chain of two leaves", "relayed"],
		["handed to a host object leaf", "hostLeaf"],
		["taken out of returned data and handed to a host object leaf", "hostLeafBoxed"],
		["run by an allowed leaf of its own accord, inside a call the denied module handed a callback", "runnerOwnWith"]
	])("refuses a closure %s (%s)", async (_label, route) => {
		expect(await api.ext.probe(route)).toBe(DENIED);
	});

	it.each([
		["a closure the maker pinned with lockCaller", "lent"],
		["a leaf of the allowed module", "leaf"],
		["an allowed leaf that runs the closure of its own accord, handed nothing", "runnerOwn"]
	])("allows %s (%s)", async (_label, route) => {
		expect(await api.ext.probe(route)).toBe(SECRET);
	});

	it("allows the host handing the closure to the same leaves", async () => {
		const made = await api.bag.make();
		expect(await api.runner.call(made)).toBe(SECRET);
		expect(await api.relay.pass(made)).toBe(SECRET);
		expect(await api.host.records.run(made)).toBe(SECRET);
		expect(await api.bag.call(made)).toBe(SECRET);
	});
});
