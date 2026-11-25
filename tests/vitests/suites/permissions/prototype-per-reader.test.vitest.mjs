/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/prototype-per-reader.test.vitest.mjs
 *	@Date: 2026-11-19T04:54:21-08:00 (1795092861)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:09:03-08:00 (1795536543)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A class's prototype reached through the api is the object itself to code nothing could refuse an
 * access through it, and one handle per class site to every other module.
 *
 * @description
 * The owner exports `Box`, the emitter class `Bus` with an instance `bus`, an instance `inst` of `Box`, and `Foo` under
 * two names (`Foo`, `Alias`); the classes live in a shared file the reader imports too, and `Box.prototype` holds a
 * module-private member `_secret`. The owner's own code, the host, and every module while the permission system is off
 * or disabled get the real prototype, so identity with their own imports holds as in plain JavaScript. Another module
 * under permissions on gets the handle: the same one by every route to the same class site (a fresh instance's
 * prototype included), so identity among what `self` hands it holds, while privacy and the write rules are still
 * decided on each access through it. A class exported under two names is two handles. `slothlet.same(a, b)` tells
 * whether two values stand for the same object behind slothlet's layers. Checked in eager and lazy mode, async and
 * live runtime.
 * @module tests/vitests/suites/permissions/prototype-per-reader
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_prototype_holders");
const BASE = resolve("api_tests/api_test_self_write_reach/api");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];

/** Every setup, with whether another module is restricted (handed the handle) and what its writes come to. */
const SETUPS = [
	{ name: "permissions off", permissions: null, restricted: false, writes: "done", privateWrites: "done" },
	{ name: "permissions disabled", permissions: { mode: "disabled" }, restricted: false, writes: "done", privateWrites: "done" },
	{
		name: "permissions on, no rules",
		permissions: {},
		restricted: true,
		writes: "threw LOOSE_SET_NOT_OWNED",
		privateWrites: "threw LOOSE_SET_NOT_OWNED"
	},
	{
		name: "permissions on, write grant",
		permissions: { rules: [{ caller: "reader.**", target: "owner.**:write", effect: "allow" }] },
		restricted: true,
		writes: "done",
		privateWrites: "threw PERMISSION_DENIED"
	}
];

/** The routes `reader.writes` writes Box's prototype by. */
const WRITE_ROUTES = ["classPrototype", "instPrototype", "freshPrototype", "freshReflect", "freshAccessor", "freshConstructor", "handed"];

/** What every identity question answers in plain JavaScript. */
const PLAIN_OWNER = {
	busInstanceOfImport: true,
	busPrototypeIsImport: true,
	busReflectIsImport: true,
	busAccessorIsImport: true,
	boxPrototypeIsImport: true,
	instPrototypeIsImport: true,
	freshPrototype: true,
	freshPrototypeIsImport: true,
	fooIsAlias: true
};

/** What the reader's identity questions answer in plain JavaScript. */
const PLAIN_READER = {
	busInstanceOfNode: true,
	busPrototypeIsNodes: true,
	instPrototypeIsNodes: true,
	freshPrototype: true,
	freshReflect: true,
	freshAccessor: true,
	freshConstructor: true,
	stable: true,
	fooIsAlias: true,
	busInstanceOfImport: true,
	boxPrototypeIsImport: true,
	freshPrototypeIsImport: true
};

describe.each(MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => SETUPS.map((setup) => ({ mode, runtime, ...setup })))))(
	"a class prototype per reader > $mode / $runtime / $name",
	({ mode, runtime, permissions, restricted, writes, privateWrites }) => {
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

		it("is the real prototype to the owner's own code, so identity with its own import holds", async () => {
			await mount();
			expect(await api.owner.identity()).toEqual(PLAIN_OWNER);
		});

		it("is the real prototype to the host", async () => {
			await mount();
			const raw = await api.owner.rawBoxPrototype();
			expect(api.owner.Box.prototype).toBe(raw);
			expect(Object.getPrototypeOf(api.owner.inst)).toBe(raw);
			expect(Object.getPrototypeOf(new api.owner.Box())).toBe(raw);
			expect(Object.getPrototypeOf(api.owner.bus)).toBe(api.owner.Bus.prototype);
			expect(api.owner.Foo.prototype).toBe(api.owner.Alias.prototype);
			expect(await api.owner.selfBoxPrototype()).toBe(raw);
		});

		it("is one handle per class site to a restricted module, by every route, and the real prototype to anyone else", async () => {
			await mount();
			const answers = await api.reader.identity();
			if (!restricted) {
				expect(answers).toEqual(PLAIN_READER);
				return;
			}
			// Identity among what `self` hands it holds; identity with its own import, and between the two names of one
			// class, does not, since each is a handle.
			expect(answers).toEqual({
				...PLAIN_READER,
				fooIsAlias: false,
				busInstanceOfImport: false,
				boxPrototypeIsImport: false,
				freshPrototypeIsImport: false
			});
		});

		it("never hands a restricted module the real prototype through a fresh instance or a hand-off, so its writes are decided", async () => {
			await mount();
			const outcome = await api.reader.writes("probe");
			const landed = {};
			for (const route of WRITE_ROUTES) landed[route] = await api.owner.take(`probe_${route}`);
			expect(outcome).toEqual(Object.fromEntries(WRITE_ROUTES.map((route) => [route, writes])));
			expect(landed).toEqual(Object.fromEntries(WRITE_ROUTES.map((route) => [route, writes === "done"])));
		});

		it("keeps module privacy for a restricted module on every route, whatever it is granted", async () => {
			await mount();
			const plain = { classPrototype: 1, freshPrototype: 1, handed: 1, listed: true };
			expect(await api.reader.privateReads()).toEqual(
				restricted
					? {
							classPrototype: "threw PERMISSION_DENIED",
							freshPrototype: "threw PERMISSION_DENIED",
							handed: "threw PERMISSION_DENIED",
							listed: false
						}
					: plain
			);
			const outcome = await api.reader.privateWrites("_made");
			expect(outcome).toEqual({ classPrototype: privateWrites, freshPrototype: privateWrites });
			expect(await api.owner.take("_made_classPrototype")).toBe(privateWrites === "done");
			expect(await api.owner.take("_made_freshPrototype")).toBe(privateWrites === "done");
		});

		it("is the owner's own prototype again when a module hands what it holds back to the owner", async () => {
			await mount();
			expect(await api.reader.handBack()).toBe(true);
		});

		it("answers slothlet.same() by the object behind each value, for a module and for the host", async () => {
			await mount();
			expect(await api.reader.same()).toEqual({
				handleAndImport: true,
				instanceAndImport: true,
				freshAndImport: true,
				nodeAndImport: true,
				fooAndAlias: true,
				boxAndFoo: false,
				handedAndImport: true,
				unrelated: false,
				primitive: true,
				nodeAndOtherNode: false
			});
			const raw = await api.owner.rawBoxPrototype();
			expect(api.slothlet.same(api.owner.Box.prototype, raw)).toBe(true);
			expect(api.slothlet.same(api.owner.Foo.prototype, api.owner.Alias.prototype)).toBe(true);
			expect(api.slothlet.same(api.owner.Box.prototype, api.owner.Foo.prototype)).toBe(false);
			expect(api.slothlet.same(api.owner.Box, api.owner.Box)).toBe(true);
			expect(api.slothlet.same(NaN, NaN)).toBe(true);
			expect(api.slothlet.same({}, {})).toBe(false);
		});
	}
);
