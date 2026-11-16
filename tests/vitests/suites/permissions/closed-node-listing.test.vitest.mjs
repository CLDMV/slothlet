/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/closed-node-listing.test.vitest.mjs
 *	@Date: 2026-11-16T00:57:15-08:00 (1794819435)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T01:15:12-08:00 (1794820512)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Listing a closed (frozen, sealed or non-extensible) function node or api root from a module refused one
 * of its members never throws (#825).
 * @description
 * A closed node or root lists every name it holds to every reader (proxy invariant), so the names a module is refused are
 * listed too; only their values stay gated. `Object.keys`, `for…in`, `Reflect.ownKeys` and `Object.isFrozen` read the
 * description of each name, which used to refuse the module a member whose value it may not read. Each row takes its
 * expected listing from a plain twin closed the same way, less what the reader is refused: a function's own
 * `prototype`, whose value holds the module's code, is described without handing that code over, and reading it is
 * refused as before.
 * @module tests/vitests/suites/permissions/closed-node-listing
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const NODE_FIXTURE = resolve("api_tests/api_test_node_set_prototype/host");
const ROOT_FIXTURE = resolve("api_tests/api_test_api_root_integrity");
const LISTER = resolve("api_tests/api_test_closed_listing/lister");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const CLOSINGS = ["preventExtensions", "seal", "freeze"];
const configs = MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime })));

/** The names a function node's listing is kept to. */
const NODE_NAMES = ["length", "name", "prototype", "inherited", "unruled"];

/** The names a root's listing is kept to. */
const ROOT_NAMES = ["length", "name", "prototype", "rnum", "data", "pnum", "tool"];

/**
 * What a listing gives, as the lister reports it.
 * @param {object|Function} value - The value listed.
 * @param {string[]} names - The names to keep.
 * @param {string[]} [refused] - Names the reader is refused, left out of what may leave them out.
 * @returns {object} The listing.
 */
function plainListing(value, names, refused = []) {
	const pick = (keys) => keys.filter((key) => names.includes(key));
	const forIn = [];
	for (const name in value) forIn.push(name);
	return {
		keys: pick(Object.keys(value)),
		forIn: pick(forIn).filter((name) => !refused.includes(name)),
		ownKeys: pick(Reflect.ownKeys(value)),
		// Asked through a Proxy, so the language's own steps answer: V8 answers `Object.isFrozen` of a sealed plain function
		// `true` though its `prototype` is still writable, where the steps, and a Proxy of it, answer `false`.
		closed: [Object.isExtensible(new Proxy(value, {})), Object.isSealed(new Proxy(value, {})), Object.isFrozen(new Proxy(value, {}))]
	};
}

/**
 * The same listing with each list in order, for twins whose own keys were made in another order.
 * @param {object} listing - The listing.
 * @returns {object} The listing, sorted.
 */
const sorted = (listing) =>
	Object.fromEntries(
		Object.entries(listing).map(([key, value]) => [key, Array.isArray(value) && key !== "closed" ? [...value].sort() : value])
	);

describe.each(configs)("closed node listing (#825) > $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	describe("a function node, listed by a module that may not call it", () => {
		const rules = [{ caller: "lister.**", target: "leaf.only.inherited", effect: "allow" }];

		/**
		 * Build the instance, give the node a prototype when asked, and close it.
		 * @param {boolean} give - Whether the node is given a prototype first.
		 * @param {string} how - How it is closed.
		 * @returns {Promise<object>} The node.
		 */
		const closedNode = async (give, how) => {
			api = await slothlet({ base: NODE_FIXTURE, silent: true, mode, runtime, permissions: { defaultPolicy: "deny", rules } });
			await api.slothlet.api.add("lister", LISTER, { moduleID: "lister" });
			await api.leaf.only;
			await api.lister;
			if (give) Object.setPrototypeOf(api.leaf.only, { inherited: 5, unruled: 6 });
			Object[how](api.leaf.only);
			return api.leaf.only;
		};

		for (const give of [false, true]) {
			it.each(CLOSINGS)(`%s, ${give ? "given a prototype" : "with its own prototype"}: lists as its plain twin does`, async (how) => {
				const node = await closedNode(give, how);
				const plain = function only() {};
				if (give) Object.setPrototypeOf(plain, { inherited: 5, unruled: 6 });
				Object[how](plain);
				expect(await api.lister.listing("leaf.only", NODE_NAMES)).toEqual(plainListing(plain, NODE_NAMES, ["unruled"]));
				// The host lists and reads it as before.
				expect(plainListing(node, NODE_NAMES)).toEqual(plainListing(plain, NODE_NAMES));
				expect([node(), typeof node.prototype]).toEqual(["only", "object"]);
			});

			it.each(CLOSINGS)(
				`%s, ${give ? "given a prototype" : "with its own prototype"}: describes its prototype without handing it over`,
				async (how) => {
					await closedNode(give, how);
					const { described, read } = await api.lister.member("leaf.only", "prototype");
					expect(described).not.toHaveProperty("threw");
					expect(described.enumerable).toBe(false);
					expect(read).toEqual({ threw: "PERMISSION_DENIED" });
					// Nothing the prototype holds is reached through what is described.
					expect(await api.lister.describedPrototypeMember("leaf.only", "constructor")).toHaveProperty("threw");
				}
			);
		}
	});

	describe.each(["objroot", "fnroot"])("the %s api root, listed by a module refused some of its members", (root) => {
		/**
		 * Build the instance over a root, with the lister added, and close the root.
		 * @param {object[]} rules - Allow rules for the lister.
		 * @param {string} how - How it is closed.
		 * @returns {Promise<object>} The api.
		 */
		const closedRoot = async (rules, how) => {
			api = await slothlet({ base: join(ROOT_FIXTURE, root), silent: true, mode, runtime, permissions: { defaultPolicy: "deny", rules } });
			await api.slothlet.api.add("lister", LISTER, { moduleID: "lister" });
			for (const member of ["data", "pnum", "tool"]) await api[member];
			await api.lister;
			Object[how](api);
			return api;
		};

		/**
		 * A plain twin of the root, closed the same way.
		 * @param {string} how - How it is closed.
		 * @returns {object|Function} The twin.
		 */
		const plainRoot = (how) => {
			const plain = root === "objroot" ? {} : Object.assign(function root() {}, { rnum: 1 });
			Object.assign(plain, { data: {}, pnum: 7, tool: {} });
			Object[how](plain);
			return plain;
		};

		/** The lister may read the root's nodes, and nothing else: the root's data and its function are refused. */
		const nodesOnly = [
			{ caller: "lister.**", target: "data.**", effect: "allow" },
			{ caller: "lister.**", target: "tool.**", effect: "allow" }
		];
		/** The lister may read everything but call the root. */
		const allButCall = [
			...nodesOnly,
			...["pnum", "rnum", "data", "tool"].map((target) => ({ caller: "lister.**", target, effect: "allow" }))
		];

		/**
		 * Check the root's listings against its plain twin, through the api the host hands the module and through `self`.
		 * `self` is the module's own binding of the root, which stays open, so only its name listings are compared.
		 * @param {string} how - How the root was closed.
		 * @returns {Promise<void>}
		 */
		const expectPlainListing = async (how) => {
			const plain = sorted(plainListing(plainRoot(how), ROOT_NAMES));
			expect(sorted(await api.lister.listing("", ROOT_NAMES, api)), "given").toEqual(plain);
			const { closed: _, ...names } = plain;
			const { closed: ___self, ...throughSelf } = sorted(await api.lister.listing("", ROOT_NAMES));
			expect(throughSelf, "self").toEqual(names);
		};

		it.each(["preventExtensions", "seal"])("%s: lists every name as its plain twin does, and withholds the values refused", async (how) => {
			await closedRoot(nodesOnly, how);
			await expectPlainListing(how);
			// A name the module is refused is described with its value withheld, and reading it is refused.
			for (const given of [api, undefined]) {
				expect(await api.lister.member("", "pnum", given)).toEqual({
					described: { enumerable: true, value: "undefined" },
					read: { threw: "PERMISSION_DENIED" }
				});
			}
			expect(api.pnum).toBe(7);
		});

		it.each(CLOSINGS)("%s: lists as its plain twin does to a module that may read its members but not call it", async (how) => {
			await closedRoot(allButCall, how);
			await expectPlainListing(how);
			if (root === "fnroot") {
				for (const given of [api, undefined]) {
					const { described, read } = await api.lister.member("", "prototype", given);
					expect(described).not.toHaveProperty("threw");
					expect(read).toEqual({ threw: "PERMISSION_DENIED" });
					expect(await api.lister.describedPrototypeMember("", "constructor", given)).toHaveProperty("threw");
				}
			}
		});

		it("freeze: a value the module may not read is fixed as it is, so a listing reading its description is refused", async () => {
			// A frozen root reports each value as it holds it (proxy invariant), and no value the module may not read is
			// handed over: the description is refused as the read is, as on a frozen node.
			await closedRoot(nodesOnly, "freeze");
			const listing = await api.lister.listing("", ROOT_NAMES, api);
			expect(listing.keys).toEqual({ threw: "PERMISSION_DENIED" });
			expect(listing.ownKeys).toEqual(plainListing(plainRoot("freeze"), ROOT_NAMES).ownKeys);
		});
	});
});
