/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/runtime/self-assign-reach.test.vitest.mjs
 *	@Date: 2026-10-18T18:47:29-07:00 (1792374449)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:00-08:00 (1795869180)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a module reaches through another module's node is that module's too, and `self` itself is
 * shared by every module of every instance (#625).
 *
 * The ownership rule held a module's writes to its own subtree for the nodes of the api, but not for what a node
 * hands back that is no node of its own: a class's `prototype`, a method of it, the constructor behind it. A module
 * could reach another module's class through `self` and change what every instance of it does, the host's
 * included. Such a value, reached through a node of another module, is held to the same rule as any other member
 * under that module's path, at any depth. An instance the other module returned is data it chose to share (#597)
 * and is left as it is.
 *
 * A symbol key is held to the same rule as a string key: refused on another module's node, allowed on the
 * module's own.
 *
 * Changing `self` itself (defining or deleting a member, its prototype, its extensibility) used to land on the
 * one object behind the runtime `self` that every module of every instance shares: a fixed definition made there
 * broke `Object.keys(self)` everywhere. Such a change now follows the rule a top-level `self.X = …` does and never
 * touches that object.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";
import { self as liveSelf } from "@cldmv/slothlet/runtime/live";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync, apiPart } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const REFUSALS = ["LOOSE_SET_NOT_OWNED", "PERMISSION_DENIED"];
// What the victim's frozen members hold while no other module has changed them.
const FROZEN_UNCHANGED = { shelf: '{"n":1}', inner: '{"n":1}', deep: '{"n":1}', box: '{"n":1}' };

/**
 * What the same members hold once every change the guest tries has been made, as the changes leave plain objects: the
 * guest's `frozenMemberWrites` run here on objects of the same shape. With the permission system off the changes go
 * through, and a write through the api reaches the victim's own objects (#746).
 */
const FROZEN_CHANGED = (() => {
	const [element, inner, deep, box] = [{ n: 1 }, { n: 1 }, { n: 1 }, { n: 1 }];
	element.planted = 1;
	Object.defineProperty(element, "defined", { value: 1, configurable: true, writable: true, enumerable: true });
	delete element.n;
	inner.planted = 1;
	delete inner.n;
	deep.planted = 1;
	delete deep.n;
	box.planted = 1;
	return { shelf: JSON.stringify(element), inner: JSON.stringify(inner), deep: JSON.stringify(deep), box: JSON.stringify(box) };
})();

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

// Host read rules keep the modules readable under `defaultPolicy: "deny"`; they say nothing about writes.
const READ_RULES = [
	{ caller: "**", target: "victim.**", effect: "allow" },
	{ caller: "**", target: "guest.**", effect: "allow" },
	{ caller: "**", target: "root.**", effect: "allow" },
	// The member `root.changeSelf` defines on the api root and reads back is data at the root, read under a rule for that leaf.
	{ caller: "root.changeSelf", target: "baseDefined", effect: "allow" },
	// So is the member `root.changeScopedSelf` defines and reads back inside a fully isolated scope.
	{ caller: "root.changeScopedSelf", target: "scoped", effect: "allow" }
];
const PERMISSIONS = [
	{ label: "no permissions config", options: {} },
	{ label: "permissions with defaults", options: { permissions: {} } },
	{ label: "permissions defaultPolicy deny", options: { permissions: { policy: "deny", rules: READ_RULES } } }
];

/**
 * A report with every refused change marked `"refused"`, so a change that went through stands out.
 * @param {Record<string, string>} report - Outcomes by change.
 * @returns {Record<string, string>} The report with each refusal replaced by `"refused"`.
 */
const markRefused = (report) =>
	Object.fromEntries(Object.entries(report).map(([key, outcome]) => [key, REFUSALS.includes(outcome) ? "refused" : outcome]));

/**
 * The report expected when every change is refused.
 * @param {Record<string, string>} report - Outcomes by change.
 * @returns {Record<string, string>} The same keys, each `"refused"`.
 */
const allRefused = (report) => Object.fromEntries(Object.keys(report).map((key) => [key, "refused"]));

/**
 * The report expected when every change went through.
 * @param {Record<string, string>} report - Outcomes by change.
 * @returns {Record<string, string>} The same keys, each `"done"`.
 */
const allDone = (report) => Object.fromEntries(Object.keys(report).map((key) => [key, "done"]));

describe.each(CONFIGS)("what a module reaches through self (#625) — $mode / $runtime", ({ mode, runtime }) => {
	describe.each(PERMISSIONS)("$label", ({ options }) => {
		const instances = [];
		// Ownership decides a module's write only while the permission system is on (#625): with it off, every write
		// a module makes goes through as plain JS lets it.
		const off = !options.permissions;

		afterEach(async () => {
			for (const api of instances.splice(0)) await api.slothlet.shutdown();
		});

		/**
		 * Load the base module and mount `victim` and `guest` beside it.
		 * @returns {Promise<object>} The composed api.
		 */
		async function load() {
			const api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, ...options });
			instances.push(api);
			await api.slothlet.api.add("victim", apiPart(FIXTURE, "victim"), { id: "victim" });
			await api.slothlet.api.add("guest", apiPart(FIXTURE, "guest"), { id: "guest" });
			return api;
		}

		it("holds a module changing another module's class prototype reached through self, at any depth, to ownership", async () => {
			const api = await load();
			const report = await withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimPrototype());
			if (off) {
				expect(Object.values(markRefused(report))).not.toContain("refused");
				expect(api.victim.v.Account.prototype.planted).toBe(1);
				return;
			}
			expect(markRefused(report)).toEqual(allRefused(report));
			const proto = api.victim.v.Account.prototype;
			expect(new api.victim.v.Account().balance()).toBe(100);
			expect(await api.victim.v.balanceOfNew()).toBe(100);
			expect(proto.planted).toBeUndefined();
			expect(proto.balance.planted).toBeUndefined();
			expect(proto.constructor.planted).toBeUndefined();
			expect(Object.getPrototypeOf(proto)).toBe(Object.prototype);
			expect(Object.getPrototypeOf(proto.balance)).toBe(Function.prototype);
			expect(Object.isExtensible(proto)).toBe(true);
		});

		it("holds a module changing another module's class prototype that module handed back to ownership", async () => {
			const api = await load();
			const report = await withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeHandedPrototype());
			expect(markRefused(report)).toEqual(off ? allDone(report) : allRefused(report));
			expect(api.victim.v.Account.prototype.planted).toBe(off ? 1 : undefined);
			if (!off) expect(new api.victim.v.Account().balance()).toBe(100);
		});

		it("lets a module write later, from outside any call, through its own class prototype it kept", async () => {
			const api = await load();
			const later = await api.victim.v.keepOwnPrototype();
			expect(later()).toBe("done");
		});

		it("lets a module use its own class prototype's members through self as plain JS does", async () => {
			const api = await load();
			expect(await api.victim.v.useOwnMembers()).toEqual({
				isArray: true,
				kinds: "basic,gold",
				arrow: 1,
				bound: "object",
				constructed: 100,
				registry: 1,
				fixedSame: true,
				fixedDeep: 1,
				fixedDescriptor: true,
				isFrozen: true,
				frozenKeys: "inner",
				frozenInner: 1,
				frozenProto: true,
				boxProto: true,
				boxClosed: true,
				boxSameProto: true,
				boxHas: true,
				boxGone: true,
				labelGetter: "function",
				computed: 2,
				fixedDelete: false,
				frozenDefine: false,
				frozenSetPrototype: false,
				stubborn: false,
				subclassed: 100
			});
		});

		it("holds a write through another module's class prototype a module kept, made later from outside any call, to ownership", async () => {
			const api = await load();
			const later = await api.guest.x.keepVictimPrototype();
			expect(withSuppressedSlothletErrorOutputSync(() => later())).toBe(off ? "done" : "LOOSE_SET_NOT_OWNED");
			if (!off) expect(new api.victim.v.Account().balance()).toBe(100);
		});

		it("holds a module changing members another module holds frozen to ownership", async () => {
			const api = await load();
			const report = await withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimFrozenMembers());
			expect(markRefused(report)).toEqual(off ? allDone(report) : allRefused(report));
			// Freezing a list leaves its elements open, so a change that goes through lands on the element.
			expect(api.victim.v.shelf[0].planted).toBe(off ? 1 : undefined);
			expect(await api.victim.v.frozenState()).toEqual(off ? FROZEN_CHANGED : FROZEN_UNCHANGED);
		});

		it("holds a write through members another module holds frozen a module kept, made later from outside any call, to ownership", async () => {
			const api = await load();
			const later = await api.guest.x.keepVictimFrozenMembers();
			const report = withSuppressedSlothletErrorOutputSync(() => later());
			expect(report).toEqual(off ? allDone(report) : Object.fromEntries(Object.keys(report).map((key) => [key, "LOOSE_SET_NOT_OWNED"])));
			expect(api.victim.v.shelf[0].planted).toBe(off ? 1 : undefined);
			expect(await api.victim.v.frozenState()).toEqual(off ? FROZEN_CHANGED : FROZEN_UNCHANGED);
		});

		it("refuses a later write through members another module holds frozen with captured references off", async () => {
			const api = await slothlet({
				base: apiPart(FIXTURE),
				mode,
				runtime,
				silent: true,
				permissions: { ...options.permissions, caller: { capture: false } }
			});
			instances.push(api);
			await api.slothlet.api.add("victim", apiPart(FIXTURE, "victim"), { id: "victim" });
			await api.slothlet.api.add("guest", apiPart(FIXTURE, "guest"), { id: "guest" });
			const later = await api.guest.x.keepVictimFrozenMembers();
			const report = withSuppressedSlothletErrorOutputSync(() => later());
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, "LOOSE_SET_NOT_OWNED"])));
			expect(await api.victim.v.frozenState()).toEqual(FROZEN_UNCHANGED);
		});

		it("stores the node itself when a module stores a member another module holds frozen", async () => {
			const api = await load();
			expect(await api.guest.x.storeVictimElement()).toBe("done");
			if (!options.permissions) {
				expect(api.guest.x.keptElement).toBe(api.victim.v.shelf[0]);
				api.guest.x.keptElement.hostNote = 1;
				expect(api.victim.v.shelf[0].hostNote).toBe(1);
				return;
			}
			// With permissions on, what a module read keeps its identity when it is handed on (#655), and acts as that
			// module wherever it is used: a change made through it with no standing of its own is the module's.
			expect(api.guest.x.keptElement).not.toBe(api.victim.v.shelf[0]);
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					api.guest.x.keptElement.hostNote = 1;
				}).toThrow(/CONTEXT_NOT_ACTIVE_SELF/);
			});
			api.victim.v.shelf[0].hostNote = 1;
			expect(api.victim.v.shelf[0].hostNote).toBe(1);
		});

		it("lets a module use another module's class as plain JS does: instances, instanceof, and a subclass", async () => {
			const api = await load();
			expect(await api.guest.x.useVictimClass()).toEqual({
				instance: true,
				subclass: true,
				balance: 100,
				own: 1,
				read: "function",
				early: false,
				primitive: false,
				namespace: "TypeError"
			});
		});

		it("lets a module change its own class's prototype through self", async () => {
			const api = await load();
			expect(await api.victim.v.writeOwnPrototype()).toEqual({ assign: "done", read: 5, remove: "done" });
			expect(api.victim.v.Account.prototype.bonus).toBeUndefined();
		});

		it("keeps the prototype of an instance another module returned to the module whose class it is", async () => {
			const api = await load();
			// The instance is what the victim handed over; its class is not. While the permission system is on the prototype
			// reaches the guest as reading `victim.v.Account.prototype` would, where the guest may not write; with it off
			// nothing is checked and the write lands, as in plain JavaScript.
			expect(await api.guest.x.changeReturnedInstancePrototype()).toBe(off ? "done" : "LOOSE_SET_NOT_OWNED");
			expect(api.victim.v.Account.prototype.shared).toBe(off ? 1 : undefined);
			delete api.victim.v.Account.prototype.shared;
		});

		it("holds a module writing symbol-keyed members on another module's node to ownership", async () => {
			const api = await load();
			const report = await withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimSymbol());
			expect(markRefused(report)).toEqual(off ? allDone(report) : allRefused(report));
			expect(api.victim.v[Symbol.for("slothlet.test.i625.guest")]).toBe(off ? 1 : undefined);
		});

		it("lets a module write symbol-keyed members on its own node", async () => {
			const api = await load();
			expect(await api.victim.v.writeOwnSymbol()).toEqual({ assign: "done", read: 1, define: "done", remove: "done", gone: true });
			expect(await api.guest.x.writeOwnSymbol()).toEqual({ assign: "done", read: 1 });
		});

		it("holds a module changing self outside what it owns to ownership, and every module of every instance can still list self", async () => {
			const api = await load();
			const other = await load();
			const report = await withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeSelf());
			if (off) {
				// As base-module code may: the root of self still refuses a fixed definition and changes to itself.
				expect(report).toEqual({
					defineFixed: "TypeError",
					define: "done",
					remove: "done",
					setPrototypeOf: "TypeError",
					preventExtensions: "TypeError",
					freeze: "TypeError",
					symbol: "done"
				});
				expect(api.zz).toBe(1);
				expect(api.victim).toBeUndefined();
				expect(await other.guest.x.listSelf()).toBe(Object.keys(other).length);
				return;
			}
			expect(markRefused(report)).toEqual(allRefused(report));
			expect(api.zz).toBeUndefined();
			expect(api[Symbol.for("slothlet.test.i625.self")]).toBeUndefined();
			for (const instance of [api, other]) {
				expect(await instance.victim.v.listSelf()).toBe(Object.keys(instance).length);
				expect(await instance.guest.x.listSelf()).toBe(Object.keys(instance).length);
				expect(await instance.root.listSelf()).toBe(Object.keys(instance).length);
			}
		});

		it("lets base-module code define and delete members of self, and refuses a fixed definition without touching what other instances see", async () => {
			const api = await load();
			const other = await load();
			expect(await api.root.changeSelf()).toEqual({
				define: "done",
				read: 7,
				remove: "done",
				gone: true,
				defineFixed: "TypeError",
				fixedGone: true,
				accessor: "done",
				accessorRead: 8,
				setPrototypeOf: "TypeError",
				preventExtensions: "TypeError"
			});
			expect(api.baseDefined).toBeUndefined();
			for (const instance of [api, other]) {
				expect(await instance.guest.x.listSelf()).toBe(Object.keys(instance).length);
			}
		});

		it("holds a module changing what another module's node holds under a symbol key, or its accessor's functions, to ownership", async () => {
			const api = await load();
			await api.victim.v.plantSymbolBox();
			const report = await withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimHeld());
			expect(markRefused(report)).toEqual(off ? allDone(report) : allRefused(report));
			expect(api.victim.v[Symbol.for("slothlet.test.i625.box")].n).toBe(off ? 2 : 1);
			expect(Object.getOwnPropertyDescriptor(api.victim.v.conf, "level").get.planted).toBe(off ? 1 : undefined);
		});

		it("holds a module writing through its view of another module's class prototype that module handed back to it to ownership", async () => {
			const api = await load();
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.echoPrototype())).toBe(off ? "done" : "LOOSE_SET_NOT_OWNED");
			expect(api.victim.v.Account.prototype.echoed).toBe(off ? 1 : undefined);
		});

		it("keeps a change base-module code makes to self inside a fully isolated scope in that scope", async () => {
			const isolated = await slothlet({
				base: apiPart(FIXTURE),
				mode,
				runtime,
				silent: true,
				scope: { isolation: "full" },
				...options
			});
			instances.push(isolated);
			let report;
			await isolated.slothlet.context.run({}, async () => {
				report = await isolated.root.changeScopedSelf();
			});
			expect(report).toEqual({ define: "done", read: 3, accessor: "done", remove: "done", gone: true });
			expect(isolated.scoped).toBeUndefined();
			expect(isolated.scopedGetter).toBeUndefined();
		});

		it("hands a module the framework's view of the framework namespace stored on another module's class", async () => {
			const api = await load();
			api.victim.v.Account.prototype.namespace = api.slothlet;
			try {
				// The built-in write rules keep the namespace from module code with the permission system on or off.
				expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeStoredNamespace())).toBe("PERMISSION_DENIED");
				expect(api.slothlet.planted).toBeUndefined();
			} finally {
				delete api.victim.v.Account.prototype.namespace;
			}
		});

		it.runIf(off)("leaves the framework namespace stored on another module's class to a module with the system disabled", async () => {
			const api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, permissions: { mode: "disabled" } });
			instances.push(api);
			await api.slothlet.api.add("victim", apiPart(FIXTURE, "victim"), { id: "victim" });
			await api.slothlet.api.add("guest", apiPart(FIXTURE, "guest"), { id: "guest" });
			api.victim.v.Account.prototype.namespace = api.slothlet;
			expect(api.guest.x.changeStoredNamespace()).toBe("done");
			expect(api.slothlet.planted).toBe(1);
		});

		it("hands the host, inside a run() it opened, the run's own copy of a module's class prototype", async () => {
			const api = await load();
			const proto = api.victim.v.Account.prototype;
			const seen = await api.slothlet.context.run({}, () => {
				const inRun = self.victim.v.Account.prototype;
				inRun.inRunOnly = 1;
				return { same: inRun === proto, readBack: inRun.inRunOnly };
			});
			// A full-isolation run reads a copy: its prototype is not the instance's, and what it writes there stays in the run.
			expect(seen).toEqual({ same: false, readBack: 1 });
			expect(Object.hasOwn(api.victim.v.Account.prototype, "inRunOnly")).toBe(false);
		});

		it.each([
			["the runtime", "async", () => self],
			["the live runtime", "live", () => liveSelf]
		])("refuses changing self from outside any call, through %s", async (_label, needs, selfOf) => {
			// The live runtime's own `self` answers for a live instance only.
			if (needs === "live" && runtime !== "live") return;
			await load();
			const self = selfOf();
			const outcome = (change) => {
				try {
					change();
					return "done";
				} catch (error) {
					return error?.code ?? error?.name;
				}
			};
			expect({
				remove: outcome(() => delete self.anything),
				define: outcome(() => Object.defineProperty(self, "anything", { value: 1, configurable: true })),
				setPrototypeOf: outcome(() => Object.setPrototypeOf(self, null)),
				preventExtensions: outcome(() => Object.preventExtensions(self))
			}).toEqual({
				remove: "CONTEXT_NOT_ACTIVE_SELF",
				define: "CONTEXT_NOT_ACTIVE_SELF",
				setPrototypeOf: "TypeError",
				preventExtensions: "TypeError"
			});
		});
	});
});

/**
 * A member a module defines or assigns on a folder (the api root, or a mount) is data at that folder's path. Reading it
 * back is decided as any read of data is: by the rules for the reading leaf at the member's path. Having made the
 * member gives a leaf no read of it. The mount `zz` is the same folder mounted again, and answers as the root does.
 */
const MADE = apiPart(FIXTURE, "made");
// Under `defaultPolicy: "deny"` these keep the leaves callable from each other; they say nothing about the made members.
const MADE_BASE_RULES = [
	{ caller: "**", target: "maker.**", effect: "allow" },
	{ caller: "**", target: "other.**", effect: "allow" },
	{ caller: "**", target: "zz.maker.**", effect: "allow" },
	{ caller: "**", target: "zz.other.**", effect: "allow" }
];
const MADE_MEMBERS = [
	{ how: "define", name: "baseDefined", value: 7 },
	{ how: "assign", name: "baseAssigned", value: 8 }
];
// The folder a member is made on, the leaf prefix of the module making it there, and the member's path prefix.
const MADE_PLACES = [
	{ where: "root", leaf: "", at: "" },
	{ where: "zz", leaf: "zz.", at: "zz." }
];

describe.each(CONFIGS)("reading back a member a module made on a folder — $mode / $runtime", ({ mode, runtime }) => {
	const instances = [];

	afterEach(async () => {
		for (const api of instances.splice(0)) await api.slothlet.shutdown();
	});

	/**
	 * Load the folder as the base and mount it again at `zz`, under `defaultPolicy: "deny"`.
	 * @param {object[]} rules - Rules added to the base rules.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(rules) {
		const api = await slothlet({
			base: MADE,
			mode,
			runtime,
			silent: true,
			permissions: { policy: "deny", rules: [...MADE_BASE_RULES, ...rules] }
		});
		instances.push(api);
		await api.slothlet.api.add("zz", MADE, { id: "zz" });
		return api;
	}

	describe.each(MADE_PLACES)("on $where", ({ where, leaf, at }) => {
		/**
		 * The module that makes the member: the base module for the root, the mounted one for `zz`.
		 * @param {object} api - The composed api.
		 * @returns {object} That module's node.
		 */
		const maker = (api) => (where === "root" ? api : api.zz);
		/**
		 * The other module, which reaches the same folder through `self`.
		 * @param {object} api - The composed api.
		 * @returns {object} That module's node.
		 */
		const stranger = (api) => (where === "root" ? api.zz : api);

		it.each(MADE_MEMBERS)(
			"refuses the leaf that made a member by $how the read of it, and lists it none, with no rule for it",
			async ({ how, name }) => {
				const api = await load([]);
				const report = await withSuppressedSlothletErrorOutputSync(() => maker(api).maker[how](where));
				expect(report.change).toBe("done");
				expect(report.read.code).toBe("PERMISSION_DENIED");
				expect(report.read.message).toContain(`caller '${leaf}maker.${how}'`);
				expect(report.read.message).toContain(`'${at}${name}'`);
				expect(report.listed).toBe(false);
			}
		);

		it.each(MADE_MEMBERS)(
			"gives the leaf that made a member by $how its value and lists it under a rule for that leaf, and refuses every other leaf",
			async ({ how, name, value }) => {
				const api = await load([{ caller: `${leaf}maker.${how}`, target: `${at}${name}`, effect: "allow" }]);
				expect(await maker(api).maker[how](where)).toEqual({ change: "done", read: value, listed: true });
				// Another leaf of the same module, and a leaf of another module: the rule names neither.
				for (const [module, prefix] of [
					[maker(api), leaf],
					[stranger(api), leaf === "" ? "zz." : ""]
				]) {
					const report = await withSuppressedSlothletErrorOutputSync(() => module.other.read(where, name));
					expect(report.read.code).toBe("PERMISSION_DENIED");
					expect(report.read.message).toContain(`caller '${prefix}other.read'`);
					expect(report.read.message).toContain(`'${at}${name}'`);
					expect(report.listed).toBe(false);
				}
			}
		);
	});
});
