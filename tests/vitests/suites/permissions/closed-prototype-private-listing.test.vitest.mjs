/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/closed-prototype-private-listing.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:08:35-08:00 (1795536515)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Listing a class prototype that is closed (frozen, sealed or non-extensible) and holds private members
 * never throws for a module privacy keeps those members from; the members' values stay unreadable.
 * @description
 * A closed prototype must list and describe every member it holds to every reader (proxy invariants), so `Object.keys`,
 * `for…in`, `Object.isFrozen` and the like, which read each member's description, used to refuse the whole listing to a
 * module that may not read a private member. Each row takes its expected answers from a plain import of the owner:
 * - the owner and the host read everything as plain JS does;
 * - another module, while privacy applies, lists a closed prototype as plain JS does (its private names included, as the
 *   invariants require), is described each private member holding a stand-in for its value whose every use is refused,
 *   and is refused reading or calling the member, as before;
 * - an open prototype's private members are left out of everything that module lists, as before;
 * - a private member an instance only inherits is left out of what the instance reports holding, closed or not.
 *
 * Fixture: `api_tests/api_test_closed_prototype_private` (`owner/` at `owner`, `reader/` at `reader`);
 * `api_tests/api_test_closed_prototype_private_lib/probes.mjs` holds the probes.
 * @module tests/vitests/suites/permissions/closed-prototype-private-listing
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { CLASS_NAMES, listing, privacy } from "../../../../api_tests/api_test_closed_prototype_private_lib/probes.mjs";

const FIXTURE = resolve("api_tests/api_test_closed_prototype_private");
const BASE = resolve("api_tests/api_test_self_write_reach/api");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];

/** The permission setups, with whether privacy keeps the owner's private members from another module. */
const SETUPS = [
	{ name: "permissions off", permissions: null, privacy: false },
	{ name: "permissions disabled", permissions: { mode: "disabled" }, privacy: false },
	{ name: "permissions on, no rules", permissions: {}, privacy: true },
	{
		name: "permissions on, full grant",
		permissions: { rules: [{ caller: "reader.**", target: "owner.**:full", effect: "allow" }] },
		privacy: true
	}
];

const PRIVATE_KEYS = ["_hidden", "_acc"];
const DENIED = "threw PERMISSION_DENIED";

let twinCount = 0;

/**
 * The owner module as plain JS, from a module instance of its own.
 * @returns {Promise<object>} Its exports.
 */
async function twin() {
	return { ...(await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?twin=${++twinCount}`)) };
}

/**
 * What a module privacy keeps the private members from lists of a class's prototype.
 * @param {object} plain - The plain listing.
 * @param {string} name - The class.
 * @returns {object} The listing.
 */
function refusedListing(plain, name) {
	// A closed prototype lists every name it holds (proxy invariant); an open one leaves the private names out.
	if (name !== "OpenBox") return plain;
	return {
		...plain,
		names: plain.names.filter((key) => !PRIVATE_KEYS.includes(key)),
		ownKeys: plain.ownKeys - PRIVATE_KEYS.length,
		descriptors: plain.descriptors - PRIVATE_KEYS.length
	};
}

/**
 * What a module privacy keeps the private members from reads of them.
 * @param {object} plain - The plain answers.
 * @param {string} name - The class.
 * @returns {object} The answers.
 */
function refusedPrivacy(plain, name) {
	const refused = { read: DENIED, call: DENIED, inInstance: false, accessor: DENIED };
	if (name === "OpenBox") {
		const missing = "threw TypeError";
		return {
			...refused,
			inPrototype: false,
			described: "none",
			describedCall: missing,
			describedName: missing,
			describedSame: missing,
			accessorDescribed: "none",
			accessorDescribedGet: missing
		};
	}
	// Described as held, with a stand-in for the value: the same object each time, and every use of it refused.
	return {
		...refused,
		inPrototype: true,
		described: plain.described,
		describedCall: DENIED,
		describedName: DENIED,
		describedSame: true,
		accessorDescribed: plain.accessorDescribed,
		accessorDescribedGet: DENIED
	};
}

describe.each(MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => SETUPS.map((setup) => ({ mode, runtime, ...setup })))))(
	"a closed class prototype holding private members > $mode / $runtime / $name",
	({ mode, runtime, permissions, privacy: privacyApplies }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		/**
		 * Build the instance with the owner and the reader mounted as modules of their own.
		 * @returns {Promise<object>} The api.
		 */
		async function mount() {
			api = await slothlet({ base: BASE, mode, runtime, silent: true, ...(permissions ? { permissions } : {}) });
			await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { id: "owner" });
			await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { id: "reader" });
			await api.owner;
			await api.reader;
			return api;
		}

		it.each(CLASS_NAMES)("%s: lists as plain JS does for the owner and the host, and never throws for another module", async (name) => {
			await mount();
			const plain = listing(await twin(), name);
			expect(await api.owner.listing(name), "owner").toEqual(plain);
			expect(listing(api.owner, name), "host").toEqual(plain);
			expect(await api.reader.listing(name), "reader").toEqual(privacyApplies ? refusedListing(plain, name) : plain);
		});

		it.each(CLASS_NAMES)(
			"%s: private members read as plain JS for the owner and the host, and stay unreadable to another module",
			async (name) => {
				await mount();
				const plain = privacy(await twin(), name);
				expect(plain.describedCall).toBe("secret");
				expect(plain.accessorDescribedGet).toBe("acc");
				expect(await api.owner.privacy(name), "owner").toEqual(plain);
				expect(privacy(api.owner, name), "host").toEqual(plain);
				expect(await api.reader.privacy(name), "reader").toEqual(privacyApplies ? refusedPrivacy(plain, name) : plain);
			}
		);
	}
);
