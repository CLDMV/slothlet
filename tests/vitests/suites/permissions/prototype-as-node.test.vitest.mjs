/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/prototype-as-node.test.vitest.mjs
 *	@Date: 2026-11-18T21:28:27-08:00 (1795066107)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:09:02-08:00 (1795536542)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A class's prototype reached through the api behaves as an api node does: one handle per prototype and
 * path, the same for every module and the host, reading as the prototype itself, with privacy and the read and write
 * rules decided on each access for whoever makes it.
 *
 * @description
 * The owner exports `Box` (also as `Alias`), a subclass `Sub`, and an instance of each, and holds a private member of
 * every name form (`_`, `__`, `___`, `____`) on `Box.prototype`. The prototype is reached by the class's `prototype`,
 * an instance's prototype (`Object.getPrototypeOf`, `Reflect.getPrototypeOf`, `__proto__`), the class's `prototype`
 * descriptor, and the prototype of a new instance. The owner and another module reach it through `self`, the host
 * through `api`, and every answer is compared with the same probe run on a plain import of the owner. The owner and the
 * host read the private members; another module is refused them on every route while the permission system is on,
 * whatever it is granted. A write is decided for whoever makes it: another module's writes land only with the system
 * off or disabled, or under a `:write` or `:full` grant, and a private member it creates is refused even then. A class
 * exported under two names is decided at the name it is read through. Checked in eager and lazy mode, async and live
 * runtime.
 *
 * Fixture: `api_tests/api_test_prototype_nodes` — `owner/` mounted at `owner`, `reader/` mounted at `reader`;
 * `api_tests/api_test_prototype_nodes_lib/probes.mjs` holds the probes every caller runs.
 * @module tests/vitests/suites/permissions/prototype-as-node
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { ROUTE_NAMES, PRIVATE_NAMES, shape, identity, privacy, write } from "../../../../api_tests/api_test_prototype_nodes_lib/probes.mjs";

const FIXTURE = resolve("api_tests/api_test_prototype_nodes");
const BASE = resolve("api_tests/api_test_self_write_reach/api");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];

/**
 * The permission setups, with whether another module's writes onto the owner's prototype land and whether privacy
 * keeps the prototype's private members from it.
 */
const SETUPS = [
	{ name: "permissions off", permissions: null, readerWrites: "done", privacy: false },
	{ name: "permissions disabled", permissions: { mode: "disabled" }, readerWrites: "done", privacy: false },
	{ name: "permissions on, no rules", permissions: {}, readerWrites: "threw LOOSE_SET_NOT_OWNED", privacy: true },
	{
		name: "permissions on, write grant",
		permissions: { rules: [{ caller: "reader.**", target: "owner.**:write", effect: "allow" }] },
		readerWrites: "done",
		privacy: true
	},
	{
		name: "permissions on, full grant",
		permissions: { rules: [{ caller: "reader.**", target: "owner.**:full", effect: "allow" }] },
		readerWrites: "done",
		privacy: true
	}
];

const WRITES = ["set", "define", "delete"];

let twinCount = 0;

/**
 * The owner module as plain JS, from a module instance of its own.
 * @returns {Promise<object>} Its exports.
 */
async function twin() {
	const namespace = await import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?twin=${++twinCount}`);
	return { ...namespace };
}

describe.each(MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => SETUPS.map((setup) => ({ mode, runtime, ...setup })))))(
	"a class prototype reached through the api > $mode / $runtime / $name",
	({ mode, runtime, permissions, readerWrites, privacy: privacyApplies }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		/**
		 * Build the instance with the owner and the reader mounted as modules of their own.
		 * @param {object|null} [config] - The permissions config, when not the setup's.
		 * @returns {Promise<object>} The api.
		 */
		async function mount(config = permissions) {
			api = await slothlet({ base: BASE, mode, runtime, silent: true, ...(config ? { permissions: config } : {}) });
			await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { id: "owner" });
			await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { id: "reader" });
			await api.owner;
			await api.reader;
			return api;
		}

		it("reads and calls as plain JS does, for the owner, another module and the host", async () => {
			await mount();
			const expected = shape(await twin());
			expect(await api.owner.shape()).toEqual(expected);
			expect(await api.reader.shape()).toEqual(expected);
			expect(shape(api.owner)).toEqual(expected);
		});

		it("is one object by every route, as plain JS has it, for the owner, another module and the host", async () => {
			await mount();
			const expected = identity(await twin());
			// The owner and the host, and every module while the permission system is off or disabled, hold the prototype
			// itself, whose `constructor` is the class rather than its node (as `self.owner.Box !== Box`); a module handed
			// the handle reads the node there.
			const itself = { ...expected, constructor: false };
			expect(await api.owner.identity()).toEqual(itself);
			expect(await api.reader.identity()).toEqual(privacyApplies ? expected : itself);
			expect(identity(api.owner)).toEqual(itself);
		});

		it("is the same object to every caller holding it as itself, and one handle per name to a module handed the handle", async () => {
			await mount();
			// The owner hands the prototype itself on; a module handed the handle gets the one deciding each write at every
			// name the class is exported under, which is neither name's own handle.
			expect(await api.reader.sameAsOwner()).toEqual(privacyApplies ? { Box: false, Alias: false } : { Box: true, Alias: true });
			expect(api.owner.Box.prototype).toBe(Object.getPrototypeOf(api.owner.inst));
			expect(api.owner.Box.prototype).toBe(api.owner.inst.__proto__);
		});

		it("lets the owner and the host read its private members, and refuses them to another module on every route while privacy applies", async () => {
			await mount();
			const expected = privacy(await twin());
			expect(await api.owner.privacy()).toEqual(expected);
			expect(privacy(api.owner)).toEqual(expected);
			const refused = {};
			for (const route of ROUTE_NAMES) {
				refused[route] = Object.fromEntries(
					PRIVATE_NAMES.map((name) => [name, { read: "threw PERMISSION_DENIED", listed: false, named: false, described: undefined }])
				);
			}
			expect(await api.reader.privacy()).toEqual(privacyApplies ? refused : expected);
		});

		it("decides each write for whoever makes it", async () => {
			await mount();
			let count = 0;
			for (const route of ROUTE_NAMES) {
				for (const how of WRITES) {
					const plainOutcome = write(await twin(), route, how, `plain_${count}`);
					for (const who of ["owner", "reader", "host"]) {
						const key = `added_${who}_${++count}`;
						if (how === "delete") await api.owner.restore(key);
						const outcome = who === "host" ? write(api.owner, route, how, key) : await api[who].write(route, how, key);
						const held = await api.owner.take(key);
						const lands = who !== "reader" || readerWrites === "done";
						expect({ who, route, how, outcome }).toEqual({ who, route, how, outcome: lands ? plainOutcome : readerWrites });
						expect({ who, route, how, held }).toEqual({ who, route, how, held: how === "delete" ? !lands : lands });
					}
				}
			}
		});

		it("refuses another module creating a private member on it wherever privacy applies, and lets the owner", async () => {
			await mount();
			for (const route of ROUTE_NAMES) {
				for (const prefix of ["_", "__", "___", "____"]) {
					const key = `${prefix}made_${route}`;
					const outcome = await api.reader.write(route, "set", key);
					expect({ route, key, outcome }).toEqual({
						route,
						key,
						outcome: privacyApplies ? (readerWrites === "done" ? "threw PERMISSION_DENIED" : readerWrites) : "done"
					});
					expect({ route, key, held: await api.owner.take(key) }).toEqual({ route, key, held: !privacyApplies });
					expect(await api.owner.write(route, "set", key)).toBe("done");
					expect(await api.owner.take(key)).toBe(true);
				}
			}
		});
	}
);

describe.each(MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime }))))(
	"one class under two names > $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		for (const order of [
			["Box", "Alias"],
			["Alias", "Box"]
		]) {
			it(`decides each write at the name the prototype is read through, ${order[0]} read first`, async () => {
				api = await slothlet({
					base: BASE,
					mode,
					runtime,
					silent: true,
					permissions: {
						rules: [
							{ caller: "reader.**", target: "owner.**:write", effect: "allow" },
							{ caller: "reader.**", target: "owner.Alias.**:write", effect: "deny" }
						]
					}
				});
				await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { id: "owner" });
				await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { id: "reader" });
				const outcome = {};
				for (const name of order) outcome[name] = await api.reader.writeAt(name, `named_${name}`);
				expect(outcome).toEqual({ Box: "done", Alias: "threw PERMISSION_DENIED" });
				expect(await api.owner.take("named_Box")).toBe(true);
				expect(await api.owner.take("named_Alias")).toBe(false);
			});
		}
	}
);
