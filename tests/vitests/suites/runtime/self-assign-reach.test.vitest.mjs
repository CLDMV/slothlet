/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-reach.test.vitest.mjs
 *	@Date: 2026-10-18T18:47:29-07:00 (1792374449)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T02:53:06-07:00 (1793008386)
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
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";
import { self as liveSelf } from "@cldmv/slothlet/runtime/live";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const REFUSALS = ["LOOSE_SET_NOT_OWNED", "PERMISSION_DENIED"];
// What the victim's frozen members hold while no other module has changed them.
const FROZEN_UNCHANGED = { shelf: '{"n":1}', inner: '{"n":1}', deep: '{"n":1}', box: '{"n":1}' };

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
	{ caller: "**", target: "root.**", effect: "allow" }
];
const PERMISSIONS = [
	{ label: "no permissions config", options: {} },
	{ label: "permissions with defaults", options: { permissions: {} } },
	{ label: "permissions defaultPolicy deny", options: { permissions: { defaultPolicy: "deny", rules: READ_RULES } } }
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
			const api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
			instances.push(api);
			await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
			await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
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
			expect(withSuppressedSlothletErrorOutputSync(() => later())).toBe(off ? "done" : "RUNTIME_NO_ACTIVE_CONTEXT_SELF");
			if (!off) expect(new api.victim.v.Account().balance()).toBe(100);
		});

		it("holds a module changing members another module holds frozen to ownership", async () => {
			const api = await load();
			const report = await withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimFrozenMembers());
			expect(markRefused(report)).toEqual(off ? allDone(report) : allRefused(report));
			// Freezing a list leaves its elements open, so a change that goes through lands on the element.
			expect(api.victim.v.shelf[0].planted).toBe(off ? 1 : undefined);
			expect(await api.victim.v.frozenState()).toEqual(FROZEN_UNCHANGED);
		});

		it("holds a write through members another module holds frozen a module kept, made later from outside any call, to ownership", async () => {
			const api = await load();
			const later = await api.guest.x.keepVictimFrozenMembers();
			const report = withSuppressedSlothletErrorOutputSync(() => later());
			expect(report).toEqual(
				off ? allDone(report) : Object.fromEntries(Object.keys(report).map((key) => [key, "RUNTIME_NO_ACTIVE_CONTEXT_SELF"]))
			);
			expect(api.victim.v.shelf[0].planted).toBe(off ? 1 : undefined);
			expect(await api.victim.v.frozenState()).toEqual(FROZEN_UNCHANGED);
		});

		it("refuses a later write through members another module holds frozen with captured references off", async () => {
			const api = await slothlet({
				base: path.join(FIXTURE, "base"),
				mode,
				runtime,
				silent: true,
				permissions: { ...options.permissions, references: { capture: false } }
			});
			instances.push(api);
			await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
			await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
			const later = await api.guest.x.keepVictimFrozenMembers();
			const report = withSuppressedSlothletErrorOutputSync(() => later());
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, "RUNTIME_NO_ACTIVE_CONTEXT_SELF"])));
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
				}).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
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

		it("leaves the prototype of an instance another module returned to the module it was handed to (#597)", async () => {
			const api = await load();
			expect(await api.guest.x.changeReturnedInstancePrototype()).toBe("done");
			expect(api.victim.v.Account.prototype.shared).toBe(1);
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
				base: path.join(FIXTURE, "base"),
				mode,
				runtime,
				silent: true,
				scope: { isolation: "full" },
				...options
			});
			instances.push(isolated);
			let report;
			await isolated.slothlet.run({}, async () => {
				report = await isolated.root.changeScopedSelf();
			});
			expect(report).toEqual({ define: "done", read: 3, accessor: "TypeError", remove: "done", gone: true });
			expect(isolated.scoped).toBeUndefined();
		});

		it("hands a module the framework's view of the framework namespace stored on another module's class", async () => {
			const api = await load();
			api.victim.v.Account.prototype.namespace = api.slothlet;
			try {
				// With the permission system off, nothing decides writes: no built-in write rule, and no ownership.
				expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeStoredNamespace())).toBe(off ? "done" : "PERMISSION_DENIED");
				expect(api.slothlet.planted).toBe(off ? 1 : undefined);
			} finally {
				delete api.victim.v.Account.prototype.namespace;
			}
		});

		it("hands the host, inside a run() it opened, a module's class prototype itself", async () => {
			const api = await load();
			const proto = api.victim.v.Account.prototype;
			expect(await api.slothlet.context.run({}, () => self.victim.v.Account.prototype === proto)).toBe(true);
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
				remove: "RUNTIME_NO_ACTIVE_CONTEXT_SELF",
				define: "RUNTIME_NO_ACTIVE_CONTEXT_SELF",
				setPrototypeOf: "TypeError",
				preventExtensions: "TypeError"
			});
		});
	});
});
