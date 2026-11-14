/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/crossing-rule-changes.test.vitest.mjs
 *	@Date: 2026-11-11T22:27:48-08:00 (1794464868)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T02:00:45-08:00 (1794477645)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A rule added or removed at runtime is honoured for values a module was already handed a view of:
 * whether a function gets another module's value itself or a view is decided again after the rules change.
 *
 * @description
 * Fixture `api_test_crossing_rules`: `owner` holds an object with an instance of a class no node exports;
 * `reader.plain` and `reader.writer` are two functions of one module that read it and try a write onto the
 * instance's prototype.
 *
 * Expected values come from the rule (PERMISSIONS.md, "Write Permissions" and the crossing guard): a function that
 * may make every write at the path a value comes from gets the value itself, and its write lands; any other function
 * gets a view, and its write is refused. That holds for the rules as they are when the value is read, so a function
 * refused before a rule change is decided again after it.
 * @module tests/vitests/suites/permissions/crossing-rule-changes
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_crossing_rules");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** What a function that is handed a view reports. */
const VIEWED = { wrapped: true, isHeld: true, write: "LOOSE_SET_NOT_OWNED" };
/** What a function that is handed the value itself reports. */
const ITSELF = { wrapped: false, isHeld: true, write: "written" };

/**
 * The two rules that grant one function of the reader every write in the owner's subtree.
 * @param {string} leaf - `plain` or `writer`.
 * @returns {object[]} The rules.
 */
const allowWrites = (leaf) => [
	{ caller: `reader.${leaf}`, target: "owner.**:write", effect: "allow" },
	{ caller: `reader.${leaf}`, target: "owner:write", effect: "allow" }
];

describe.each(matrix)("crossing views follow runtime rule changes > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	/**
	 * Build an instance with the owner and the reader mounted as modules of their own.
	 * @param {object[]} rules - The rules to start with.
	 * @returns {Promise<void>}
	 */
	async function mount(rules = []) {
		api = await slothlet({
			base: join(FIXTURE, "host"),
			silent: true,
			mode,
			runtime,
			permissions: { defaultPolicy: "allow", attribution, rules }
		});
		await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { moduleID: "owner" });
		await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
		await api.owner;
		await api.reader;
	}

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("hands the function a view was first made for the value itself once a rule grants it the writes", async () => {
		await mount();
		expect(await api.reader.plain("__a1_")).toEqual(VIEWED);
		const ids = allowWrites("plain").map((rule) => api.slothlet.permissions.addRule(rule));
		expect(await api.reader.plain("__a2_")).toEqual(ITSELF);
		expect(await api.owner.landed("__a")).toEqual(["2_"]);
		for (const id of ids) api.slothlet.permissions.removeRule(id);
		expect(await api.reader.plain("__a3_")).toEqual(VIEWED);
		expect(await api.owner.landed("__a")).toEqual([]);
	});

	it("hands another function of the module, refused once already, the value itself once a rule grants it the writes", async () => {
		await mount();
		// `plain` reads first, so the view is made for it; `writer` is then decided against the same view.
		expect(await api.reader.plain("__b1_")).toEqual(VIEWED);
		expect(await api.reader.writer("__b2_")).toEqual(VIEWED);
		const ids = allowWrites("writer").map((rule) => api.slothlet.permissions.addRule(rule));
		expect(await api.reader.writer("__b3_")).toEqual(ITSELF);
		// The function no rule names is still handed the view.
		expect(await api.reader.plain("__b4_")).toEqual(VIEWED);
		expect(await api.owner.landed("__b")).toEqual(["3_"]);
		for (const id of ids) api.slothlet.permissions.removeRule(id);
		expect(await api.reader.writer("__b5_")).toEqual(VIEWED);
		expect(await api.reader.plain("__b6_")).toEqual(VIEWED);
	});

	it("hands a function a view again once the rule that granted it the writes is removed, and the value itself when it is added back", async () => {
		await mount();
		const first = allowWrites("writer").map((rule) => api.slothlet.permissions.addRule(rule));
		expect(await api.reader.writer("__c1_")).toEqual(ITSELF);
		expect(await api.reader.plain("__c2_")).toEqual(VIEWED);
		for (const id of first) api.slothlet.permissions.removeRule(id);
		expect(await api.reader.writer("__c3_")).toEqual(VIEWED);
		const second = allowWrites("writer").map((rule) => api.slothlet.permissions.addRule(rule));
		expect(await api.reader.writer("__c4_")).toEqual(ITSELF);
		expect(await api.owner.landed("__c")).toEqual(["1_", "4_"]);
		for (const id of second) api.slothlet.permissions.removeRule(id);
	});

	it("decides again when the permission system is switched off and on", async () => {
		await mount(allowWrites("writer"));
		expect(await api.reader.plain("__d1_")).toEqual(VIEWED);
		api.slothlet.permissions.control.disable();
		// Off: nothing is viewed and no write is refused on ownership.
		expect(await api.reader.plain("__d2_")).toEqual(ITSELF);
		api.slothlet.permissions.control.enable();
		expect(await api.reader.plain("__d3_")).toEqual(VIEWED);
		expect(await api.reader.writer("__d4_")).toEqual(ITSELF);
		expect(await api.owner.landed("__d")).toEqual(["2_", "4_"]);
	});
});
