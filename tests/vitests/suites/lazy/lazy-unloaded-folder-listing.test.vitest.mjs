/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-unloaded-folder-listing.test.vitest.mjs
 *	@Date: 2026-11-15T09:01:29-08:00 (1794762089)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:51:10-08:00 (1794775870)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A lazy folder that has not loaded yet is listed to a module as it is once it has loaded, whatever the
 * rules say of its path: a folder stays listed, and a file's primitive default export the rules deny is left out.
 *
 * @description
 * The `reader` module lists the api root and `outer` through `self`, with a deny on each member's exact path, or on the
 * member and everything beneath it. In lazy mode it lists before the folders (`folder`, `outer.inner`) have loaded and
 * again after; both listings are the eager listing, where everything is loaded from the start.
 * @module tests/vitests/suites/lazy/lazy-unloaded-folder-listing
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_lazy_unloaded_listing");

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** The members each rule set names. */
const MEMBERS = ["folder", "outer.inner", "outer.pdata", "outer.file"];

/** Each rule set, by name. */
const RULE_SETS = {
	"no rule": [],
	"a deny on each member's exact path": MEMBERS.map((target) => ({ caller: "reader.**", target, effect: "deny" })),
	"a deny on each member and everything beneath it": MEMBERS.map((target) => ({
		caller: "reader.**",
		target: `${target}.**`,
		effect: "deny"
	}))
};

/** What each listing asks `in` about. */
const NAMES = { "": ["folder", "outer", "reader", "nope"], outer: ["inner", "pdata", "file", "nope"] };

/**
 * The reader's listings of the root and of `outer`.
 * @param {object} api - The api.
 * @returns {Promise<object>} Each listing, by path.
 */
async function listings(api) {
	return { root: await api.reader.list("", NAMES[""]), outer: await api.reader.list("outer", NAMES.outer) };
}

/**
 * The listings in eager mode, where every folder has loaded from the start.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The listings.
 */
async function eagerListings(options) {
	const api = await slothlet({ ...options, mode: "eager" });
	try {
		return await listings(api);
	} finally {
		await api.shutdown();
	}
}

describe.each(configs)(
	"a lazy folder not loaded yet is listed as it is once loaded > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it.each(Object.keys(RULE_SETS))("%s", async (name) => {
			const options = {
				base: FIXTURE,
				runtime,
				silent: true,
				permissions: { defaultPolicy: "allow", attribution, rules: RULE_SETS[name] }
			};
			const expected = await eagerListings(options);
			api = await slothlet({ ...options, mode });
			await api.outer;
			if (mode === "lazy") {
				expect(api.slothlet.node(api.folder).materialized).toBe(false);
				expect(api.slothlet.node(api.outer.inner).materialized).toBe(false);
			}
			expect(await listings(api)).toEqual(expected);
			await api.folder;
			await api.outer.inner;
			expect(await listings(api)).toEqual(expected);
		});
	}
);

describe.each(["off", "disabled"])(
	"a lazy folder not loaded yet is listed as it is once loaded > lazy / permissions %s",
	(permissionsMode) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("lists every member", async () => {
			const options = {
				base: FIXTURE,
				silent: true,
				permissions: { mode: permissionsMode, rules: RULE_SETS["a deny on each member's exact path"] }
			};
			const expected = await eagerListings(options);
			api = await slothlet({ ...options, mode: "lazy" });
			await api.outer;
			expect(await listings(api)).toEqual(expected);
			await api.folder;
			await api.outer.inner;
			expect(await listings(api)).toEqual(expected);
		});
	}
);
