/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/api-root-member-listing.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:19-08:00 (1794882619)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shared body of the api-root-member-listing tests: a module's listings and reads of the api root follow the rules its listings and reads of any other node
 * follow, and a file's primitive default export at the root is its value, as it is one level down.
 *
 * @description
 * Each of three roots (a folder of files, a folder whose root file's default export is a function, and one whose root
 * file's default export is an async function) is loaded as the api and mounted again at `zz`, so every member the root
 * holds has a twin one level down: a folder, a file of named exports, a function, a file's default object, a file's
 * default primitive of every kind, and for the function roots the root file's named primitives of every kind, an object
 * of data and a function. A `reader` module the rules name and an `open` module they do not list and read both through
 * `self`, the `self` they kept at load, and `self.slothlet.diag.api()`, under the same rule written for the root's
 * member and for its twin. The expected answers are the twin's, and for the host, and for a module no rule names,
 * the whole listing; a file's primitive default reads as the plain module's default export. Eager and lazy mode, the
 * async and live runtime, both attributions, and the permission system off and disabled.
 *
 * The cases are spread over the `suites/proxies/api-root-member-listing-*.test.vitest.mjs` files by root and mode (see
 * {@link describeApiRootMemberListing}) so each file finishes in a few minutes; together they run every case the
 * single file ran.
 * @module tests/vitests/setup/api-root-member-listing
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_root_listing");

const ROOTS = ["objroot", "fnroot", "asyncroot"];
const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

const configs = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));

/** A file's default primitive, of every kind. */
const FILE_PRIMITIVES = ["pnum", "pstr", "pbool", "pnull", "pundef", "pbig", "psym"];

/** The root file's named primitives, of every kind (function roots only). */
const ROOT_PRIMITIVES = ["rnum", "rstr", "rbool", "rnull", "rundef", "rbig", "rsym"];

/** Every member of a function root besides the reading modules. */
const FN_MEMBERS = ["folder", "file", "fn", "dobj", ...FILE_PRIMITIVES, ...ROOT_PRIMITIVES, "rdata", "rfn"];

/** Every member of an object root besides the reading modules. */
const OBJ_MEMBERS = ["folder", "file", "fn", "dobj", ...FILE_PRIMITIVES];

/** The names the root holds that a node elsewhere does not. */
const ROOT_ONLY = new Set(["slothlet", "shutdown", "destroy", "initialize", "zz"]);

/**
 * The members of a root.
 * @param {string} root - The root's folder.
 * @returns {string[]} Its members.
 */
const membersOf = (root) => (root === "objroot" ? OBJ_MEMBERS : FN_MEMBERS);

/**
 * A value as the fixture's modules describe it.
 * @param {*} value - The value.
 * @returns {*} Its description.
 */
function described(value) {
	if (typeof value === "bigint" || typeof value === "symbol") return { [typeof value]: String(value) };
	if (value === undefined) return { undefined: true };
	if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	return { [typeof value]: true };
}

/**
 * The host's listing of a node: its member names, and what each holds.
 * @param {object} node - The node.
 * @returns {object} The listing.
 */
function hostListing(node) {
	const entries = Object.entries(node).filter(([key]) => !ROOT_ONLY.has(key));
	return { keys: entries.map(([key]) => key), values: entries.map(([, value]) => described(value)) };
}

/**
 * Each rule set, written for a prefix: `""` for the root's members, `"zz."` for their twins.
 * @type {Record<string, {rules: function(string, string[]): object[], defaultPolicy?: string, context?: object, everyRoute?: boolean}>}
 */
const RULE_SETS = {
	"no rule": { rules: () => [] },
	"a deny on each member's exact path": {
		everyRoute: true,
		rules: (p, members) => members.map((member) => ({ caller: "reader.**", target: p + member, effect: "deny" }))
	},
	"a deny on each member and everything beneath it": {
		rules: (p, members) => members.map((member) => ({ caller: "reader.**", target: `${p}${member}.**`, effect: "deny" }))
	},
	"a deny with a more specific allow beneath it": {
		rules: (p) => [
			{ caller: "reader.**", target: `${p}rdata`, effect: "deny" },
			{ caller: "reader.**", target: `${p}rdata.x`, effect: "allow" },
			{ caller: "reader.**", target: `${p}dobj.**`, effect: "deny" },
			{ caller: "reader.**", target: `${p}dobj.a`, effect: "allow" },
			{ caller: "reader.**", target: `${p}folder.**`, effect: "deny" },
			{ caller: "reader.**", target: `${p}folder.a`, effect: "allow" }
		]
	},
	"a default deny with allows": {
		everyRoute: true,
		policy: "deny",
		rules: (p) => [
			{ caller: "open.**", target: "**", effect: "allow" },
			{ caller: "zz.open.**", target: "**", effect: "allow" },
			{ caller: "reader.**", target: "reader.**", effect: "allow" },
			{ caller: "reader.**", target: "zz.reader.**", effect: "allow" },
			{ caller: "reader.**", target: "slothlet.**", effect: "allow" },
			{ caller: "reader.**", target: `${p}pstr`, effect: "allow" },
			{ caller: "reader.**", target: `${p}rstr`, effect: "allow" },
			{ caller: "reader.**", target: `${p}rdata.y.**`, effect: "allow" },
			{ caller: "reader.**", target: `${p}file.**`, effect: "allow" }
		]
	},
	"a deny whose condition matches": {
		context: { gate: "on" },
		rules: (p, members) => members.map((member) => ({ caller: "reader.**", target: p + member, effect: "deny", condition: { gate: "on" } }))
	},
	"a deny whose condition does not match": {
		context: { gate: "off" },
		rules: (p, members) => members.map((member) => ({ caller: "reader.**", target: p + member, effect: "deny", condition: { gate: "on" } }))
	}
};

/**
 * Build an instance over a root, with the same folder mounted again at `zz`, every member loaded.
 * @param {string} root - The root's folder.
 * @param {object} options - Instance options.
 * @param {{load?: boolean}} [how] - Whether to load every member first (lazy mode).
 * @returns {Promise<object>} The api.
 */
async function build(root, options, { load = true } = {}) {
	const api = await slothlet({ base: join(FIXTURE, root), silent: true, diagnostics: true, ...options });
	await api.slothlet.api.add("zz", join(FIXTURE, root), { id: "zz" });
	if (load) {
		for (const member of [...membersOf(root), "reader", "open"]) {
			await api[member];
			await api.zz[member];
		}
	}
	return api;
}

/**
 * The plain module's default export of each of a root's files of a default primitive.
 * @param {string} root - The root's folder.
 * @returns {Promise<Record<string, *>>} Each, by member name.
 */
async function plainDefaults(root) {
	const found = {};
	for (const member of FILE_PRIMITIVES) {
		const module = await import(`${pathToFileURL(join(FIXTURE, root, `${member}.mjs`)).href}?plain-twin-root-listing`);
		found[member] = module.default;
	}
	return found;
}

/**
 * Assert a module lists and reads the root's members as it does their twins at `zz`, through every route.
 * @param {object} api - The api.
 * @param {string} who - The module: `reader` or `open`.
 * @param {string[]} members - The root's members.
 * @param {string[]} [routes] - The routes to list and read through: `self`, the `self` kept at load, `getAPI()`.
 * @returns {Promise<void>}
 */
async function expectTwin(api, who, members, routes = ["self"]) {
	for (const via of routes) {
		expect(await api[who].list("", via), `${who} lists the root through ${via}`).toEqual(await api[who].list("zz", via));
		for (const member of [...members, "reader", "open"]) {
			expect(await api[who].read(member, via), `${who} reads ${member} through ${via}`).toEqual(await api[who].read(`zz.${member}`, via));
		}
	}
	for (const member of [...members, "reader", "open"]) {
		expect(await api[who].settle(member), `${who} awaits ${member}`).toEqual(await api[who].settle(`zz.${member}`));
	}
	// What self.slothlet.diag.describe() lists of the root, and hands over, is what the module's own listing of it gives.
	const { keys, all } = await api[who].describe();
	const listed = await api[who].list("");
	expect([...keys].sort()).toEqual(listed.ownKeys);
	expect(all.map(([key]) => key).sort()).toEqual(listed.ownKeys);
	expect(all.filter(([key]) => listed.keys.includes(key))).toEqual(listed.entries);
}

/**
 * Register the api-root-member-listing cases for the roots and configs a test file runs.
 * @param {object} options - What to run.
 * @param {string[]} options.roots - Entries of the fixture's roots: `"objroot"`, `"fnroot"`, `"asyncroot"`.
 * @param {string[]} [options.modes=["eager", "lazy"]] - The modes, in the matrix and in the permissions off / disabled
 *   cases.
 * @param {string[]} [options.runtimes=["async", "live"]] - The runtimes of the matrix.
 * @returns {void}
 * @example
 * describeApiRootMemberListing({ roots: ["objroot"], modes: ["eager"] });
 */
export function describeApiRootMemberListing({ roots, modes = MODES, runtimes = RUNTIMES }) {
	const selected = configs.filter((config) => modes.includes(config.mode) && runtimes.includes(config.runtime));
	describe.each(ROOTS.filter((root) => roots.includes(root)))("the api root's listing and reads > %s", (root) => {
		const members = membersOf(root);

		describe.each(selected)("$mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
			let api;

			afterEach(async () => {
				await api?.shutdown?.();
				api = null;
			});

			it.each(Object.keys(RULE_SETS))("a module lists and reads the root's members as their twins one level down: %s", async (name) => {
				const set = RULE_SETS[name];
				api = await build(root, {
					mode,
					runtime,
					context: set.context,
					permissions: {
						policy: set.defaultPolicy ?? "allow",
						caller: {
							attribution
						},
						rules: [...set.rules("", members), ...set.rules("zz.", members)]
					}
				});
				// Every route for the rule sets that refuse the most; `self` alone for the rest.
				const routes = set.everyRoute ? ["self", "kept", "api"] : ["self"];
				await expectTwin(api, "reader", members, routes);
				await expectTwin(api, "open", members, routes);
				// A module no rule names, and the host, are given the whole listing, as at any other node.
				const whole = hostListing(api.zz);
				expect((await api.open.list("")).keys).toEqual(whole.keys);
				expect(hostListing(api)).toEqual(whole);
				// The root file's own code reads its own members as the twin's own code does.
				if (root !== "objroot") {
					for (const member of ROOT_PRIMITIVES) expect(api.rfn(member), `the root file reads ${member}`).toBe(api.zz.rfn(`zz.${member}`));
				}
			});

			it("a lazy member not loaded yet is listed and read as its twin", async () => {
				const set = RULE_SETS["a deny on each member's exact path"];
				api = await build(
					root,
					{
						mode,
						runtime,
						permissions: { policy: "allow", caller: { attribution }, rules: [...set.rules("", members), ...set.rules("zz.", members)] }
					},
					{ load: false }
				);
				expect(await api.reader.list("")).toEqual(await api.reader.list("zz"));
				for (const member of members)
					expect(await api.reader.settle(member), `reader awaits ${member}`).toEqual(await api.reader.settle(`zz.${member}`));
			});

			it("a file's primitive default export at the root reads as its value, as one level down and in plain JavaScript", async () => {
				api = await build(root, { mode, runtime, permissions: { policy: "allow", caller: { attribution }, rules: [] } });
				const plain = await plainDefaults(root);
				for (const member of FILE_PRIMITIVES) {
					expect(described(api[member]), `the host reads ${member}`).toEqual(described(api.zz[member]));
					expect(await api.open.read(member), `a module reads ${member}`).toEqual(described(api.zz[member]));
				}
				// The kinds a node one level down reads as their value read as the plain module's default export.
				for (const member of ["pnum", "pstr", "pbool", "pbig", "psym"]) expect(api[member]).toBe(plain[member]);
			});
		});

		describe.each(["off", "disabled"])("permissions %s", (permissionsMode) => {
			let api;

			afterEach(async () => {
				await api?.shutdown?.();
				api = null;
			});

			it.each(modes)("nothing is left out of a listing or refused: %s", async (mode) => {
				const set = RULE_SETS["a deny on each member's exact path"];
				api = await build(root, {
					mode,
					permissions: { mode: permissionsMode, rules: [...set.rules("", members), ...set.rules("zz.", members)] }
				});
				await expectTwin(api, "reader", members);
				const whole = hostListing(api.zz);
				expect((await api.reader.list("")).keys).toEqual(whole.keys);
				expect(hostListing(api)).toEqual(whole);
				for (const member of members) expect(await api.reader.read(member)).not.toEqual({ threw: "PERMISSION_DENIED" });
			});
		});
	});
}
