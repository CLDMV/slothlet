/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-node-member-deny.test.vitest.mjs
 *	@Date: 2026-11-13T17:28:41-08:00 (1794619721)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T23:21:07-08:00 (1794640867)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A rule denying a module the exact path of an object member of another module's data hides that member
 * from it, as a rule on the path and everything beneath it does; a more specific allow still lets what it names through.
 *
 * @description
 * The fixture's `owner` file exports `ruled = { nested: { public: 1, kept: { deep: 2 }, hidden: 3 }, prim: 4 }`. A
 * reader the rules name and a writer they do not read it through `self` in eager and lazy mode, the async and live
 * runtime, and under both attributions. The expected answers are plain JavaScript's on the same object with what the
 * reader may not read left out.
 * @module tests/vitests/suites/proxies/api-node-member-deny
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_node_default_data");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

const guarded = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));

/** What is refused. */
const DENIED = { threw: "PERMISSION_DENIED" };

/**
 * Build an instance with the owner, the files of single values, the reader and the writer mounted as modules of their
 * own, every node the checks touch loaded.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	for (const name of ["owner", "single", "reader", "writer"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
	for (const name of ["owner", "single", "reader", "writer"]) await api[name];
	await api.owner.ruled;
	await api.single.dconfig;
	return api;
}

/**
 * How plain JavaScript lists and serializes an object, as the fixture's `listingsAt` gives them.
 * @param {object} value - The object.
 * @returns {object} The listings.
 */
function listed(value) {
	return {
		keys: Object.keys(value),
		spread: Object.keys({ ...value }),
		json: JSON.stringify(value),
		clone: JSON.stringify(structuredClone(value)),
		entries: Object.entries(value).map(([member]) => member)
	};
}

/**
 * The plain-JavaScript twins of the fixture's data, imported as a module imports them, outside slothlet.
 * @returns {Promise<{ruled: object, dconfig: object}>} The owner's `ruled` and the `single/dconfig` file's default export.
 */
async function twins() {
	const owner = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-member-deny`);
	const dconfig = await import(`${pathToFileURL(join(FIXTURE, "single", "dconfig.mjs")).href}?plain-twin-member-deny`);
	return { ruled: owner.ruled, dconfig: dconfig.default };
}

describe.each(guarded)("an exact deny on an object member's path > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const build = (rules) => mount({ mode, runtime, permissions: { defaultPolicy: "allow", attribution, rules } });

	it.each([
		{ form: "the member's path", target: "owner.ruled.nested" },
		{ form: "the member's path and everything beneath it", target: "owner.ruled.nested.**" }
	])("hides the member from the reader in reads, listings and serialization: $form", async ({ target }) => {
		const { ruled } = await twins();
		const { nested: ___nested, ...rest } = ruled;
		api = await build([{ caller: "reader.**", target, effect: "deny" }]);
		expect(await api.reader.listingsAt("owner.ruled")).toEqual(listed(rest));
		expect(await api.reader.listingsAt("owner.ruled.nested")).toEqual(listed({}));
		expect(await api.reader.readAt("owner.ruled.nested")).toEqual({ object: "{}" });
		expect(await api.reader.readAt("owner.ruled.nested.public")).toEqual(DENIED);
		expect(await api.reader.readAt("owner.ruled.nested.kept")).toEqual({ object: "{}" });
		expect(await api.reader.readAt("owner.ruled.nested.kept.deep")).toEqual(DENIED);
		expect(await api.reader.readAt("owner.ruled.prim")).toBe(ruled.prim);
		// `in` answers as for a primitive member the reader may not read: the key is there.
		expect(await api.reader.hasAt("owner.ruled", "nested")).toBe("nested" in ruled);
		// A module the rule does not name, and the host, see everything, as in plain JavaScript.
		expect(await api.writer.listingsAt("owner.ruled")).toEqual(listed(ruled));
		expect(await api.writer.readAt("owner.ruled.nested.kept.deep")).toBe(ruled.nested.kept.deep);
		expect(listed(api.owner.ruled)).toEqual(listed(ruled));
		expect(api.owner.ruled.nested.hidden).toBe(ruled.nested.hidden);
	});

	it.each([
		{ form: "the member's path", target: "owner.ruled.nested" },
		{ form: "the member's path and everything beneath it", target: "owner.ruled.nested.**" }
	])("a more specific allow beneath it lets what it names through: $form", async ({ target }) => {
		const { ruled } = await twins();
		const seen = { nested: { public: ruled.nested.public }, prim: ruled.prim };
		api = await build([
			{ caller: "reader.**", target, effect: "deny" },
			{ caller: "reader.**", target: "owner.ruled.nested.public", effect: "allow" },
			// Allows that name the object holding the member, or another member, leave the member's own answers alone.
			{ caller: "reader.**", target: "owner.ruled", effect: "allow" },
			{ caller: "reader.**", target: "owner.ruled.prim", effect: "allow" }
		]);
		expect(await api.reader.listingsAt("owner.ruled")).toEqual(listed(seen));
		expect(await api.reader.listingsAt("owner.ruled.nested")).toEqual(listed(seen.nested));
		expect(await api.reader.readAt("owner.ruled.nested.public")).toBe(ruled.nested.public);
		expect(await api.reader.readAt("owner.ruled.nested.hidden")).toEqual(DENIED);
		expect(await api.reader.readAt("owner.ruled.nested.kept.deep")).toEqual(DENIED);
		expect(await api.writer.listingsAt("owner.ruled")).toEqual(listed(ruled));
	});

	it("a reader no rule names reads every member, as in plain JavaScript", async () => {
		const { ruled } = await twins();
		api = await build([]);
		expect(await api.reader.listingsAt("owner.ruled")).toEqual(listed(ruled));
		expect(await api.reader.listingsAt("owner.ruled.nested")).toEqual(listed(ruled.nested));
		expect(await api.reader.readAt("owner.ruled.nested.kept.deep")).toBe(ruled.nested.kept.deep);
	});

	it("hides the members the rules name in data with more members than the rules' records keep", async () => {
		const { many } = await import(`${pathToFileURL(join(FIXTURE, "bulk", "bulk.mjs")).href}?plain-twin-member-deny`);
		const { m0: ___m0, ...rest } = many;
		api = await build([{ caller: "reader.**", target: "bulk.many.m0", effect: "deny" }]);
		await api.slothlet.api.add("bulk", join(FIXTURE, "bulk"), { moduleID: "bulk" });
		await api.bulk.many;
		expect(await api.reader.readAt("bulk.many.m0.v")).toEqual(DENIED);
		expect((await api.reader.listingsAt("bulk.many")).json).toBe(JSON.stringify(rest));
		await api.shutdown();
		api = await build([{ caller: "reader.**", target: "bulk.many.**", effect: "deny" }]);
		await api.slothlet.api.add("bulk", join(FIXTURE, "bulk"), { moduleID: "bulk" });
		await api.bulk.many;
		expect((await api.reader.listingsAt("bulk.many")).json).toBe("{}");
		expect(await api.writer.readAt("bulk.many.m1099.v")).toBe(many.m1099.v);
	}, 120_000);

	it.each([
		{ form: "a module's path", target: "owner" },
		{ form: "a folder's path", target: "single" },
		{ form: "the path of a file's default export", target: "single.dconfig" }
	])("leaves what is beneath the path readable for $form", async ({ target }) => {
		const { ruled, dconfig } = await twins();
		api = await build([{ caller: "reader.**", target, effect: "deny" }]);
		expect(await api.reader.listingsAt("owner.ruled")).toEqual(listed(ruled));
		expect(await api.reader.readAt("owner.ruled.nested.kept.deep")).toBe(ruled.nested.kept.deep);
		expect(await api.reader.listingsAt("single.dconfig")).toEqual(listed(dconfig));
		expect(await api.reader.readAt("single.dconfig.one.n")).toBe(dconfig.one.n);
	});
});
