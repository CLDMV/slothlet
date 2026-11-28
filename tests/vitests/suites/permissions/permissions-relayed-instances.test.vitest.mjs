/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-relayed-instances.test.vitest.mjs
 *	@Date: 2026-11-16T01:00:00-08:00 (1794819600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:38-08:00 (1795869158)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An instance a leaf asks for itself, inside a call another module handed a callback: its methods and
 * getters, run on that instance by the leaf's own code, are held to the leaf alone under "precise". Every other way of
 * running the class's code there stays held to the caller as well.
 *
 * @description
 * Fixture `api_test_load_identity`. Rules: everything is denied the vault except `bag` and `runner`. `bag` hands out
 * instances of a class whose method, async method and getter read the vault. `ext` (denied) calls `runner`'s leaves,
 * handing each a callback or a value, so the call was handed code.
 *
 * Under "precise" each instance has a stand-in of each of its methods of its own, which records the instance: run with
 * that instance as its receiver, by the code of the call the instance was handed to alone, it answers as the leaf.
 * With any other receiver (a method of another instance or class called on the leaf's instance, the leaf's method
 * called on another object, the class's own method read through the class), or once the instance was handed on, it is
 * held to the calls that handed code down. Under "fast" nothing is wrapped: the stack cannot tell the leaf's instance
 * from one the caller handed in, so every route is refused.
 *
 * @module tests/vitests/suites/permissions/permissions-relayed-instances
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
	{ caller: "runner.**", target: "vault.**", effect: "allow" }
];

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

describe.each(MATRIX)("Permissions > an instance inside a call handed a callback > $name", ({ attribution, mode, runtime }) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({
			base: DIR,
			mode,
			runtime,
			silent: true,
			permissions: { policy: "allow", caller: { attribution }, rules: RULES }
		});
		// Load every file, so a lazy node answers as an eager one.
		await api.vault.get();
		await api.bag.call(() => 1);
		await api.runner.call(() => 1);
		await api.ext.ping();
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it.each([
		["a method run on it", "instRun"],
		["a method run on it after an await", "instRunLater"],
		["an async method run on it", "instLater"],
		["a getter read on it", "instGetter"]
	])("an instance the leaf asked for itself, %s by the leaf (%s): allowed under precise, refused under fast", async (_label, route) => {
		expect(await api.ext.probe(route)).toBe(attribution === "precise" ? SECRET : DENIED);
	});

	it.each([
		["a method of the caller's instance of the same class, called on the leaf's instance", "instCallSameClass"],
		["a method of the caller's instance of another class, called on the leaf's instance", "instCallOtherClass"],
		["a method of the caller's instance, bound to the leaf's instance", "instBindSameClass"],
		["the leaf's instance's method, called on the caller's instance", "instForeign"],
		["the class's own method read through the class, called on the leaf's instance", "instProto"],
		["a method of an instance the caller handed in", "handedInstRun"],
		["a getter of an instance the caller handed in", "handedInstGetter"],
		["a method of the leaf's instance once it was handed out to the caller, handed back bound", "instShared"]
	])("refuses %s (%s)", async (_label, route) => {
		expect(await api.ext.probe(route)).toBe(DENIED);
	});

	it("allows the host calling the same leaves", async () => {
		expect(await api.runner.instRun(() => 1)).toBe(SECRET);
		expect(await api.runner.instGetter(() => 1)).toBe(SECRET);
		expect(await api.runner.callRun(await api.bag.inst())).toBe(SECRET);
	});

	it("keeps a method read twice from one instance the same function, and under precise the instance's own", async () => {
		const first = await api.bag.inst();
		const second = await api.bag.inst();
		expect(first.run).toBe(first.run);
		expect(first.run.call(first)).toBe(SECRET);
		// Under "precise" each instance's method is its own stand-in. Under "fast" this test asserts nothing more: the host
		// is handed what the runtime hands it, unchanged by this rule.
		if (attribution === "precise") expect(first.run).not.toBe(second.run);
	});
});
