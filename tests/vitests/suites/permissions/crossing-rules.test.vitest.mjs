/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-rules.test.vitest.mjs
 *	@Date: 2026-11-11T10:00:39-08:00 (1794420039)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T10:14:52-08:00 (1794420892)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The rules deciding what one module's value reaches another module as, checked one rule at a time.
 *
 * @description
 * A module that may make every write at the path a value comes from gets the value itself; any other gets a view
 * through which the owner's code cannot be changed. Each function of a module is decided by the rules naming it, so a
 * function a write rule names gets the value itself whichever of its module's functions read the value first. Checked in
 * eager and lazy mode, the async and live runtime, and both `permissions.attribution` values.
 * @module tests/vitests/suites/permissions/crossing-rules
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_crossing_rules");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

/** Grants one function of the reader every write in the owner's subtree. */
const ALLOW_WRITER_LEAF = [
	{ caller: "reader.writer", target: "owner.**:write", effect: "allow" },
	{ caller: "reader.writer", target: "owner:write", effect: "allow" }
];

/**
 * Build an instance with the owner and the reader mounted as modules of their own.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { moduleID: "owner" });
	await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
	await api.owner;
	await api.reader;
	return api;
}

/** Refuses one of two files loaded from one folder every write to the other. */
const DENY_GUEST_WRITES = [
	{ caller: "guest.**", target: "keeper.**:write", effect: "deny" },
	{ caller: "guest.**", target: "keeper:write", effect: "deny" }
];

const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));

describe.each(matrix)("crossing rules > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each([
		{ order: "the function with no rule reads it first", first: "plain", second: "writer" },
		{ order: "the function the rule names reads it first", first: "writer", second: "plain" }
	])("hands a function a write rule names the value itself when $order", async ({ first, second }) => {
		api = await mount({ mode, runtime, permissions: { defaultPolicy: "allow", attribution, rules: ALLOW_WRITER_LEAF } });
		const outcome = { [first]: await api.reader[first](`__${first}_`), [second]: await api.reader[second](`__${second}_`) };
		// Plain JavaScript hands every reader the object itself; the function with no write rule is the deviation the
		// guard needs, and its write onto the owner's class is refused.
		expect(outcome).toEqual({
			writer: { wrapped: false, isHeld: true, write: "written" },
			plain: { wrapped: true, isHeld: true, write: "LOOSE_SET_NOT_OWNED" }
		});
		expect(await api.owner.landed("__writer_")).toEqual([""]);
		expect(await api.owner.landed("__plain_")).toEqual([]);
	});

	it("keeps a file's class from a file of the same folder a rule refuses the write, by every route", async () => {
		api = await slothlet({
			base: join(FIXTURE, "pair"),
			silent: true,
			mode,
			runtime,
			permissions: { defaultPolicy: "allow", attribution, rules: DENY_GUEST_WRITES }
		});
		// The rule names the write, so each is refused as a write the rule denies.
		expect(await api.guest.reach("__denied_")).toEqual({
			returned: "PERMISSION_DENIED",
			callback: "PERMISSION_DENIED",
			stored: "PERMISSION_DENIED"
		});
		expect(await api.keeper.landed("__denied_")).toEqual([]);
	});

	it("leaves two files of one folder each other's values where no rule stands between them", async () => {
		api = await slothlet({
			base: join(FIXTURE, "pair"),
			silent: true,
			mode,
			runtime,
			permissions: { defaultPolicy: "allow", attribution }
		});
		// Plain JavaScript: both files hold the instance itself, and the write lands.
		expect(await api.guest.reach("__open_")).toEqual({ returned: "written", callback: "written", stored: "written" });
		expect(await api.keeper.landed("__open_")).toEqual(["returned", "callback", "stored"]);
	});

	it("keeps the owner's code from a view a module holds past the instance's shutdown", async () => {
		api = await mount({ mode, runtime, permissions: { defaultPolicy: "allow", attribution } });
		expect(await api.reader.keep()).toBe(true);
		await api.shutdown();
		api = null;
		// The module was handed a view because it may not write the owner's code; the instance ending grants it nothing.
		// A write onto the class is refused as one made in no call of the instance, a method shadowed on the instance as
		// one the module does not own. Data it was handed stays its to change.
		expect(globalThis.__crossingRulesReader.writeThroughKept("__after_")).toEqual({
			getPrototypeOf: "RUNTIME_NO_ACTIVE_CONTEXT_SELF",
			proto: "RUNTIME_NO_ACTIVE_CONTEXT_SELF",
			constructor: "RUNTIME_NO_ACTIVE_CONTEXT_SELF",
			method: "RUNTIME_NO_ACTIVE_CONTEXT_SELF",
			keptPrototype: "RUNTIME_NO_ACTIVE_CONTEXT_SELF",
			shadowed: "LOOSE_SET_NOT_OWNED",
			data: "written"
		});
		expect(globalThis.__crossingRulesOwner.landed("__after_")).toEqual([]);
	});

	it("leaves a module the value itself past shutdown where it held the value itself", async () => {
		api = await mount({ mode, runtime });
		expect(await api.reader.keep()).toBe(false);
		await api.shutdown();
		api = null;
		// Plain JavaScript: with the permission system off the module holds the owner's object, before and after.
		expect(globalThis.__crossingRulesReader.writeThroughKept("__off_")).toEqual({
			getPrototypeOf: "written",
			proto: "written",
			constructor: "written",
			method: "written",
			keptPrototype: "written",
			shadowed: "written",
			data: "written"
		});
		expect(globalThis.__crossingRulesOwner.landed("__off_")).toEqual(["getPrototypeOf", "proto", "constructor", "keptPrototype", "hi"]);
	});
});
