/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/prototype-crossings.test.vitest.mjs
 *	@Date: 2026-11-08T10:29:10-08:00 (1794162550)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:13:44-08:00 (1794183224)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's class prototype reaches another module, by whatever route it crosses, as reading it at its
 * path would give it (#667).
 *
 * @description
 * The owner reads `Foo.prototype` through `self`, or holds it in its own binding, and hands it to the reader: thrown on
 * an error, rejected with, emitted through slothlet's event system to a listener of the reader's (delivered at once,
 * through a host strategy's `defaultDeliver`, or held and delivered later with `deliver`), held by a `WeakRef`, held by a
 * frozen object, returned, handed in nested in plain data or in a frozen object, and carried by the error an
 * `owner.throwWith:error` hook of the reader's is handed. The reader also
 * reads it from the class's `prototype` descriptor. A reader that may not write `owner.Foo.prototype` is refused its
 * write on every route, and one that may (permissions off, or a write rule granting it) writes it. A write grant hands
 * the object itself only when no rule refuses the reader anything beneath the path, at every name the class is exported
 * as; each write through the view is decided at the path read, whichever name was read first. A listener the owner
 * registered itself hears what the owner emits as it was emitted. The host is handed the
 * object itself as a module call's return value. A function the reader hands the owner is plain JS the owner calls
 * directly, so nothing here covers what the owner passes it. Checked in eager and lazy mode, async and live runtime,
 * and again after `reload()`.
 * @module tests/vitests/suites/unified-wrapper/prototype-crossings
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { types } from "node:util";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_prototype_crossings");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];

/** Grants the reader writes into the owner's subtree, and refuses it nothing. */
const ALLOW_READER_WRITES = { caller: "reader.**", target: "owner.**:write", effect: "allow" };

const REFUSED = "threw LOOSE_SET_NOT_OWNED";
const DENIED = "threw PERMISSION_DENIED";

/** The routes the owner hands its prototype by, each as the reader's call making the write. */
const ROUTES = {
	thrown: (api, source, key) => api.reader.writeThrown(source, key),
	rejected: (api, source, key) => api.reader.writeRejected(source, key),
	emitted: (api, source, key) => api.reader.writeEmitted(source, key),
	emittedThroughStrategy: async (api, source, key) => {
		api.slothlet.event.strategy((_envelope, _listeners, defaultDeliver) => defaultDeliver());
		try {
			return await api.reader.writeEmitted(source, key);
		} finally {
			api.slothlet.event.strategy(null);
		}
	},
	deliveredLater: async (api, source, key) => {
		const held = [];
		api.slothlet.event.strategy((envelope) => {
			held.push(envelope);
		});
		try {
			const id = await api.reader.listen(key);
			await api.owner.emitWith(source);
			for (const envelope of held) await api.slothlet.event.deliver(envelope, id);
		} finally {
			api.slothlet.event.strategy(null);
		}
		return api.reader.heardOutcome(key);
	},
	dereferenced: (api, source, key) => api.reader.writeDereferenced(source, key),
	frozen: (api, source, key) => api.reader.writeFrozen(source, key),
	returned: (api, source, key) => api.reader.writeReturned(source, key),
	nested: (api, source, key) => api.owner.giveNested(source, key),
	frozenArgument: (api, source, key) => api.owner.giveFrozen(source, key),
	hooked: (api, source, key) => api.reader.writeHooked(source, key)
};

/**
 * Build an instance with the owner and the reader mounted as modules of their own, every event subscriber delivered
 * the payload.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	// Event payloads reach every subscriber, so what a listener is handed is decided by the write rules alone.
	const events = { default: "allow" };
	const permissions = options.permissions ? { ...options.permissions, events } : { enabled: false, events };
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, hook: { enabled: true }, ...options, permissions });
	await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { moduleID: "owner" });
	await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
	await api.owner;
	await api.reader;
	return api;
}

/**
 * Make the reader's write by every route, and see where each landed.
 * @param {object} api - The api.
 * @param {"self"|"local"} source - Where the owner reads the prototype.
 * @param {string} tag - Tells this round's keys apart.
 * @returns {Promise<{outcome: object, landed: object}>} Each route's outcome, and whether its write landed.
 */
async function writeByEveryRoute(api, source, tag) {
	const outcome = {};
	const landed = {};
	for (const [route, write] of Object.entries(ROUTES)) {
		const key = `__crossing_${tag}_${source}_${route}`;
		outcome[route] = await write(api, source, key);
		landed[route] = await api.owner.takeFromPrototype(key);
	}
	const described = `__crossing_${tag}_described`;
	outcome.described = await api.reader.writeDescribed(described);
	landed.described = await api.owner.takeFromPrototype(described);
	return { outcome, landed };
}

/**
 * The same value for every route.
 * @param {*} value - The value.
 * @returns {object} The values.
 */
const everyRoute = (value) => Object.fromEntries([...Object.keys(ROUTES), "described"].map((route) => [route, value]));

describe.each(
	MODES.flatMap((mode) =>
		RUNTIMES.flatMap((runtime) =>
			[
				{ name: "permissions off", permissions: null, writesLand: true },
				{ name: "permissions on, no rules", permissions: {}, writesLand: false },
				{ name: "reader's writes allowed", permissions: { rules: [ALLOW_READER_WRITES] }, writesLand: true }
			].map((entry) => ({ mode, runtime, ...entry }))
		)
	)
)("a prototype handed on by every route > $mode / $runtime / $name", ({ mode, runtime, permissions, writesLand }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	describe.each(["self", "local"])("read by the owner from %s", (source) => {
		it("reaches the reader as reading it at its path would, before and after reload()", async () => {
			api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
			for (const tag of ["first", "reloaded"]) {
				if (tag === "reloaded") await api.slothlet.reload();
				const { outcome, landed } = await writeByEveryRoute(api, source, tag);
				expect(outcome).toEqual(everyRoute(writesLand ? "written" : REFUSED));
				expect(landed).toEqual(everyRoute(writesLand));
			}
		});

		it("is the object itself to the host as a module call's return value, before and after reload()", async () => {
			api = await mount({ mode, runtime, ...(permissions ? { permissions } : {}) });
			for (const tag of ["first", "reloaded"]) {
				if (tag === "reloaded") await api.slothlet.reload();
				const returned = await api.owner.returnPrototype(source);
				const settled = await api.owner.returnPrototypeLater(source);
				expect({ returned: types.isProxy(returned), settled: types.isProxy(settled) }).toEqual({ returned: false, settled: false });
				expect(settled).toBe(returned);
				returned[`__host_${tag}`] = 1;
				expect(await api.owner.takeFromPrototype(`__host_${tag}`)).toBe(true);
			}
		});
	});
});

describe.each(MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime }))))(
	"a write rule over a prototype's path > $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("keeps a deny beneath a write grant, whoever reads it", async () => {
			api = await mount({
				mode,
				runtime,
				permissions: {
					rules: [
						ALLOW_READER_WRITES,
						{ caller: "reader.**", target: "owner.Foo.prototype.hi:write", effect: "deny" },
						{ caller: "owner.**", target: "owner.Foo.prototype.hi:write", effect: "deny" }
					]
				}
			});
			for (const tag of ["first", "reloaded"]) {
				if (tag === "reloaded") await api.slothlet.reload();
				expect(await api.reader.writeThrough("Foo", `__grant_${tag}`)).toBe("written");
				expect(await api.owner.takeFromPrototype(`__grant_${tag}`)).toBe(true);
				expect(await api.reader.writeThrough("Foo", "hi")).toBe(DENIED);
				expect(await api.reader.writeReturned("self", "hi")).toBe(DENIED);
				expect(await api.owner.takeFromPrototype("hi")).toBe(false);
				expect(await api.owner.writeOwn("Foo", `__own_${tag}`)).toBe("written");
				expect(await api.owner.takeFromPrototype(`__own_${tag}`)).toBe(true);
				expect(await api.owner.writeOwn("Foo", "hi")).toBe(DENIED);
				expect(await api.owner.takeFromPrototype("hi")).toBe(false);
			}
		});

		it("grants the write at the prototype's own path only, not the members beneath it", async () => {
			api = await mount({
				mode,
				runtime,
				permissions: { rules: [{ caller: "reader.**", target: "owner.Foo.prototype:write", effect: "allow" }] }
			});
			for (const tag of ["first", "reloaded"]) {
				if (tag === "reloaded") await api.slothlet.reload();
				expect(await api.reader.writeThrough("Foo", `__exact_${tag}`)).toBe(REFUSED);
				expect(await api.reader.writeReturned("self", `__exact_${tag}`)).toBe(REFUSED);
				expect(await api.owner.takeFromPrototype(`__exact_${tag}`)).toBe(false);
			}
		});

		it("decides again once the rules change", async () => {
			api = await mount({ mode, runtime, permissions: { rules: [ALLOW_READER_WRITES] } });
			expect(await api.reader.writeThrough("Foo", "__before")).toBe("written");
			expect(await api.owner.takeFromPrototype("__before")).toBe(true);
			api.slothlet.permissions.addRule({ caller: "reader.**", target: "owner.Foo.prototype.hi:write", effect: "deny" });
			expect(await api.reader.writeThrough("Foo", "hi")).toBe(DENIED);
			expect(await api.owner.takeFromPrototype("hi")).toBe(false);
		});

		describe.each([
			{ name: "Foo read first", order: ["Foo", "Alias"] },
			{ name: "Alias read first", order: ["Alias", "Foo"] }
		])("one class under two names, $name", ({ order }) => {
			it("decides each write at the name it is read through", async () => {
				api = await mount({
					mode,
					runtime,
					permissions: { rules: [ALLOW_READER_WRITES, { caller: "reader.**", target: "owner.Alias.**:write", effect: "deny" }] }
				});
				const outcome = {};
				for (const name of order) outcome[name] = await api.reader.writeThrough(name, `__named_${name}`);
				expect(outcome).toEqual({ Foo: "written", Alias: DENIED });
				expect(await api.owner.takeFromPrototype("__named_Foo")).toBe(true);
				expect(await api.owner.takeFromPrototype("__named_Alias")).toBe(false);
			});
		});

		describe.each([
			{ name: "Foo read first", order: ["Foo", "Alias"] },
			{ name: "Alias read first", order: ["Alias", "Foo"] }
		])("one class under two names, $name", ({ order }) => {
			it("hands the object itself only to a reader that may hold it at every name", async () => {
				api = await mount({
					mode,
					runtime,
					permissions: {
						rules: [
							ALLOW_READER_WRITES,
							{ caller: "reader.**", target: "owner.Alias.**:write", effect: "deny" },
							{ caller: "owner.**", target: "owner.Alias.**:write", effect: "deny" }
						]
					}
				});
				const reader = {};
				const owner = {};
				for (const name of order) {
					reader[name] = await api.reader.holdsItself(name);
					owner[name] = await api.owner.holdsItself(name);
				}
				expect({ reader, owner }).toEqual({ reader: { Foo: false, Alias: false }, owner: { Foo: false, Alias: false } });
				expect(await api.owner.writeOwn("Foo", "__owner_Foo")).toBe("written");
				expect(await api.owner.writeOwn("Alias", "__owner_Alias")).toBe(DENIED);
				expect(await api.owner.takeFromPrototype("__owner_Foo")).toBe(true);
				expect(await api.owner.takeFromPrototype("__owner_Alias")).toBe(false);
			});

			it("hands a listener the owner registered itself what the owner emits, as it was emitted", async () => {
				api = await mount({
					mode,
					runtime,
					permissions: { rules: [{ caller: "owner.**", target: "owner.Alias.**:write", effect: "deny" }] }
				});
				for (const name of order) await api.owner.holdsItself(name);
				for (const tag of ["first", "reloaded"]) {
					if (tag === "reloaded") await api.slothlet.reload();
					expect({ local: await api.owner.hearsOwnEmit("local"), self: await api.owner.hearsOwnEmit("self") }).toEqual({
						local: true,
						self: true
					});
				}
			});

			it("hands a reader's listener what the owner emits as reading it at every name would", async () => {
				api = await mount({
					mode,
					runtime,
					permissions: { rules: [ALLOW_READER_WRITES, { caller: "reader.**", target: "owner.Alias.**:write", effect: "deny" }] }
				});
				for (const name of order) await api.reader.holdsItself(name);
				expect(await api.reader.writeEmitted("local", "__emitted_aliased")).toBe(DENIED);
				expect(await api.owner.takeFromPrototype("__emitted_aliased")).toBe(false);
			});

			it("hands the object itself to a reader that may hold it at every name", async () => {
				api = await mount({ mode, runtime, permissions: { rules: [ALLOW_READER_WRITES] } });
				const reader = {};
				const owner = {};
				for (const name of order) {
					reader[name] = await api.reader.holdsItself(name);
					owner[name] = await api.owner.holdsItself(name);
				}
				expect({ reader, owner }).toEqual({ reader: { Foo: true, Alias: true }, owner: { Foo: true, Alias: true } });
			});
		});

		it("hands the prototype on, before anything read it, as reading it at every name would", async () => {
			api = await mount({
				mode,
				runtime,
				permissions: { rules: [ALLOW_READER_WRITES, { caller: "reader.**", target: "owner.Alias.**:write", effect: "deny" }] }
			});
			expect(await api.reader.writeReturned("local", "__aliased")).toBe(DENIED);
			expect(await api.owner.takeFromPrototype("__aliased")).toBe(false);
		});

		it("hands the owner's own binding of the prototype, before anything read it, as reading it would", async () => {
			api = await mount({ mode, runtime, permissions: {} });
			expect(await api.reader.writeReturned("local", "__unread")).toBe(REFUSED);
			expect(await api.owner.takeFromPrototype("__unread")).toBe(false);
		});
	}
);
