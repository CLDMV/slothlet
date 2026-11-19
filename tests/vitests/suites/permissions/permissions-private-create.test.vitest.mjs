/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-private-create.test.vitest.mjs
 *	@Date: 2026-11-18T18:21:58-08:00 (1795054918)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T18:30:03-08:00 (1795055403)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module can't create a module-private member on a node it doesn't own.
 *
 * @description
 * A `_`/`__`-prefixed member of a node is private to the module that owns the node: the privacy read gate refuses any
 * other module a read of it. Creating one is held to the same answer: wherever the gate would refuse the creator a read
 * of that name on that node, the creation is refused with the same error, by every way plain JS creates a member
 * (assignment, `defineProperty`, `Reflect.set`, `Reflect.defineProperty`, a function's own property, a class
 * prototype, an instance's prototype through `Object.getPrototypeOf` and through `__proto__`). Everything else answers
 * as plain JS does, checked against a plain-JS twin of the owning module: a module creating private members on its own
 * node, other names on the other module's node where its writes are allowed, and every creation with the permission
 * system off, where the privacy gate does not apply. Names with three or four leading underscores are the framework's: creating one on another module's node is refused as a `__` one is.
 * Checked in eager and lazy mode, async and live runtime.
 *
 * Fixture: `api_tests/api_test_private_create` — `owned/` mounted at `owned`, `creator/` mounted at `creator`;
 * `api_tests/api_test_private_create_lib/creations.mjs` holds the creations both modules and the twin run.
 * @module tests/vitests/suites/permissions/permissions-private-create
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { HOWS, create, read } from "../../../../api_tests/api_test_private_create_lib/creations.mjs";
import { withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = resolve("api_tests/api_test_private_create");
const BASE = resolve("api_tests/api_test_self_write_reach/base");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];

/** Grants the creator writes into the owned module's subtree, and refuses it nothing else. */
const WRITE_GRANT = [{ caller: "creator.**", target: "owned.**:write", effect: "allow" }];

/**
 * The permission setups, with what the creator's writes on the other module's node meet: `"plain"` where they land as
 * plain JS (the system off, so no privacy gate), `"private"` where they are allowed but a private name is refused as
 * reading it is, `"owner"` where the ownership rule refuses every write on another module's node.
 */
const SETUPS = [
	{ name: "permissions off", permissions: null, other: "plain" },
	{ name: "permissions on, write grant", permissions: { rules: WRITE_GRANT }, other: "private" },
	{
		name: "permissions on, write grant, folder scope",
		permissions: { private: { scope: "folder" }, rules: WRITE_GRANT },
		other: "private"
	},
	{ name: "permissions on, no write grant", permissions: {}, other: "owner" }
];

/**
 * The owning module's own private member each creation's route reaches (prefixed `_` or `__`): its exported value,
 * its function's own property, and its class prototype's member.
 */
const EXISTING = {
	set: "secret",
	define: "secret",
	reflectSet: "secret",
	reflectDefine: "secret",
	functionOwn: "tag",
	classPrototype: "hidden",
	instancePrototype: "hidden",
	protoAccessor: "hidden"
};

/** Module-private name prefixes, which the privacy gate covers. */
const PRIVATE_PREFIXES = ["__", "_"];

/** The framework's name prefixes, which module code creates on another module's node no more than a `__` one. */
const FRAMEWORK_PREFIXES = ["___", "____"];

let twinCount = 0;

/**
 * The owned module as plain JS: its exports on a plain object, from a module instance of its own.
 * @returns {Promise<object>} The twin node.
 */
async function twin() {
	const namespace = await import(`${pathToFileURL(join(FIXTURE, "owned", "owned.mjs")).href}?twin=${++twinCount}`);
	return { ...namespace };
}

/**
 * What plain JS answers for a creation and the read of it after.
 * @param {string} how - The creation.
 * @param {string} key - The member name.
 * @returns {Promise<{created: string, read: string}>} The outcomes.
 */
async function plain(how, key) {
	const node = await twin();
	const created = create(node, how, key);
	return { created, read: read(node, how, key) };
}

/**
 * What plain JS answers for reading a member nothing created.
 * @param {string} how - The creation whose read is made.
 * @param {string} key - The member name.
 * @returns {Promise<string>} The outcome.
 */
async function absent(how, key) {
	return read(await twin(), how, key);
}

let keyCount = 0;

/**
 * A member name no other case uses, so a prototype write of one case never shows in another.
 * @param {string} prefix - The name's prefix.
 * @param {string} how - The creation.
 * @returns {string} The name.
 */
const keyFor = (prefix, how) => `${prefix}k${how}${++keyCount}`;

describe.each(MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => SETUPS.map((setup) => ({ mode, runtime, ...setup })))))(
	"creating a module-private member > $mode / $runtime / $name",
	({ mode, runtime, permissions, other }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		/**
		 * Build an instance with the owned module and the creator mounted as modules of their own.
		 * @returns {Promise<object>} The api.
		 */
		async function mount() {
			api = await slothlet({ base: BASE, mode, runtime, silent: true, ...(permissions ? { permissions } : {}) });
			await api.slothlet.api.add("owned", join(FIXTURE, "owned"), { id: "owned" });
			await api.slothlet.api.add("creator", join(FIXTURE, "creator"), { id: "creator" });
			await api.owned;
			await api.creator;
			return api;
		}

		/**
		 * Have the creator make one member and read it back, and have the owning module read the same member.
		 * @param {string} where - `"own"` or `"other"`.
		 * @param {string} how - The creation.
		 * @param {string} key - The member name.
		 * @returns {Promise<{created: string, read: string, ownerRead?: string}>} The outcomes.
		 */
		async function creatorMakes(where, how, key) {
			const created = withSuppressedSlothletErrorOutputSync(() => api.creator.create(where, how, key));
			const readBack = withSuppressedSlothletErrorOutputSync(() => api.creator.read(where, how, key));
			if (where === "own") return { created, read: readBack };
			return { created, read: readBack, ownerRead: withSuppressedSlothletErrorOutputSync(() => api.owned.read(how, key)) };
		}

		for (const prefix of PRIVATE_PREFIXES) {
			it(`answers creating a "${prefix}" member on another module's node as reading one there is answered`, async () => {
				await mount();
				// What the creator gets reading the owning module's own private member of that name form, by each route.
				const existing = Object.fromEntries(
					HOWS.map((how) => [how, withSuppressedSlothletErrorOutputSync(() => api.creator.read("other", how, `${prefix}${EXISTING[how]}`))])
				);
				if (other === "private") expect(existing.set).toBe("PERMISSION_DENIED");
				for (const how of HOWS) {
					const key = keyFor(prefix, how);
					const outcome = await creatorMakes("other", how, key);
					const twinAnswer = await plain(how, key);
					if (other === "plain" || (other === "private" && existing[how] === "1")) {
						// No privacy gate on the route: plain JS.
						expect({ how, ...outcome }).toEqual({ how, ...twinAnswer, ownerRead: twinAnswer.read });
					} else if (other === "private") {
						// Refused with the error the read of the owning module's private member gets, and nothing was created.
						const missing = await absent(how, key);
						expect({ how, ...outcome }).toEqual({ how, created: existing[how], read: missing, ownerRead: missing });
					} else {
						expect({ how, created: outcome.created }).toEqual({ how, created: "LOOSE_SET_NOT_OWNED" });
						expect({ how, ownerRead: outcome.ownerRead }).toEqual({ how, ownerRead: await absent(how, key) });
					}
				}
			});

			it(`lets a module create a "${prefix}" member on its own node, and read it back, as plain JS does`, async () => {
				await mount();
				for (const how of HOWS) {
					const key = keyFor(prefix, how);
					const creator = await creatorMakes("own", how, key);
					expect({ how, ...creator }).toEqual({ how, ...(await plain(how, key)) });
					const ownerKey = keyFor(prefix, how);
					const owner = {
						created: withSuppressedSlothletErrorOutputSync(() => api.owned.create(how, ownerKey)),
						read: withSuppressedSlothletErrorOutputSync(() => api.owned.read(how, ownerKey))
					};
					expect({ how, ...owner }).toEqual({ how, ...(await plain(how, ownerKey)) });
				}
			});
		}

		it("answers creating a public member on another module's node as plain JS where the module's writes are allowed", async () => {
			await mount();
			for (const how of HOWS) {
				const key = keyFor("", how);
				const outcome = await creatorMakes("other", how, key);
				if (other === "owner") {
					expect({ how, created: outcome.created }).toEqual({ how, created: "LOOSE_SET_NOT_OWNED" });
					continue;
				}
				const twinAnswer = await plain(how, key);
				expect({ how, ...outcome }).toEqual({ how, ...twinAnswer, ownerRead: twinAnswer.read });
			}
		});

		it('answers creating a member with three or four leading underscores on another module\'s node as a "__" one', async () => {
			await mount();
			// What the creator gets reading the owning module's own "__" member, by each route.
			const existing = Object.fromEntries(
				HOWS.map((how) => [how, withSuppressedSlothletErrorOutputSync(() => api.creator.read("other", how, `__${EXISTING[how]}`))])
			);
			for (const prefix of FRAMEWORK_PREFIXES) {
				for (const how of HOWS) {
					const key = keyFor(prefix, how);
					const outcome = await creatorMakes("other", how, key);
					const twinAnswer = await plain(how, key);
					if (other === "plain" || (other === "private" && existing[how] === "1")) {
						// No privacy gate on the route: plain JS.
						expect({ prefix, how, ...outcome }).toEqual({ prefix, how, ...twinAnswer, ownerRead: twinAnswer.read });
						continue;
					}
					// Refused, so nothing was created: the creator and the owning module read nothing there.
					const missing = await absent(how, key);
					expect({ prefix, how, ...outcome }).toEqual({
						prefix,
						how,
						created: other === "private" ? "PERMISSION_DENIED" : "LOOSE_SET_NOT_OWNED",
						read: missing,
						ownerRead: missing
					});
				}
			}
		});

		it("lets a module create a member with three or four leading underscores on its own node, and read it back, as plain JS does", async () => {
			await mount();
			for (const prefix of FRAMEWORK_PREFIXES) {
				for (const how of HOWS) {
					const key = keyFor(prefix, how);
					const creator = await creatorMakes("own", how, key);
					expect({ prefix, how, ...creator }).toEqual({ prefix, how, ...(await plain(how, key)) });
				}
			}
		});
	}
);
