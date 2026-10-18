/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-nested-ownership.test.vitest.mjs
 *	@Date: 2026-10-17T21:13:18-07:00 (1792296798)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T02:34:43-07:00 (1792316083)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Nested `self.X.Y = …` writes follow the ownership rule top-level writes do (#625).
 *
 * A top-level `self.X = …` goes through the runtime `self` set trap, which refuses a module writing
 * outside its own mount point with `LOOSE_SET_NOT_OWNED`. A write below the top level reaches the
 * wrapper at `self.X` instead, and used to land unchecked: a module could replace another module's
 * member or plant new code under its mount point. These tests hold the nested write to the same rule
 * — assignment, `Object.defineProperty`, and `delete` alike — while leaving everything the top-level
 * rule allows untouched: writes under the module's own subtree, host writes, base-module writes, two
 * modules sharing a mount point, and the framework's own `api.add` invoked by a module.
 *
 * Fixture: `api_tests/api_test_nested_self_assign` — `callee/`, `vault/`, `supplier/`, `callee_peer/`, `twin/`, `svc/`, `evil/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_NESTED_SELF_ASSIGN;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("nested self assignment ownership (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Mount `callee`, `vault`, and `supplier` as three separate modules over a base tree.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function mountModules(options = {}) {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("callee", path.join(FIXTURE, "callee"), { moduleID: "callee" });
		await api.slothlet.api.add("vault", path.join(FIXTURE, "vault"), { moduleID: "vault" });
		await api.slothlet.api.add("supplier", path.join(FIXTURE, "supplier"), { moduleID: "supplier" });
		return api;
	}

	it("refuses a module replacing a member of another module's subtree", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.replaceCalleeMember()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("refuses a module planting a new member under another module's mount point", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.plantOnCallee()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(api.callee.planted).toBeUndefined();
	});

	it("refuses a module writing a primitive below another module's mount point", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.writeCalleePrimitive()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(api.callee.ops.flag).toBeUndefined();
	});

	it("names the refused path and the writing module in the error", async () => {
		await mountModules();
		let caught = null;
		withSuppressedSlothletErrorOutputSync(() => {
			try {
				api.supplier.attack.replaceCalleeMember();
			} catch (error) {
				caught = error;
			}
		});
		expect(caught?.code).toBe("LOOSE_SET_NOT_OWNED");
		expect(caught.message).toContain("callee.ops.useSecret");
		expect(caught.message).toContain("supplier");
	});

	it("refuses a module defining a member of another module's subtree", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.defineOnCallee()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("refuses a module deleting a member of another module's subtree", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.deleteFromCallee()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("leaves a symbol-keyed member to plain JS, as at the top level (a symbol is never an api path)", async () => {
		await mountModules();
		expect(await api.supplier.attack.writeCalleeSymbol()).toBe(true);
	});

	it("allows a module writing below its own mount point", async () => {
		await mountModules();
		expect(await api.supplier.attack.writeOwnNested("own-leaf")).toBe("own-leaf");
		expect(await api.supplier.attack.writeOwnNamespace("own-ns")).toBe("own-ns");
		expect(await api.callee.ops.writeOwnNested("callee-own")).toBe("callee-own");
		expect(api.callee.ops.note).toBe("callee-own");
	});

	it("allows the host writing anywhere in the tree", async () => {
		await mountModules();
		api.callee.ops.hostNote = "from-host";
		api.callee.ops.useSecret = () => "host-replaced";
		expect(api.callee.ops.hostNote).toBe("from-host");
		expect(await api.callee.ops.useSecret()).toBe("host-replaced");
	});

	it("allows base-module code writing anywhere (it owns the whole tree)", async () => {
		api = await slothlet({ base: FIXTURE, mode, runtime, silent: true });
		// Load the target node first: under lazy mode a write through a node that has not loaded yet
		// is a separate matter from ownership, and this test is about who may write, not when.
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
		await api.supplier.attack.replaceCalleeMember();
		expect(await api.callee.ops.useSecret()).toBe("pwned");
	});

	it("allows two modules mounted at the same point to write under it", async () => {
		await mountModules();
		await api.slothlet.api.add("callee", path.join(FIXTURE, "callee_peer"), { moduleID: "callee-peer" });
		expect(await api.callee.peer.writeShared("shared")).toBe("shared");
		expect(api.callee.ops.peerNote).toBe("shared");
	});

	it("lets a module's own api.add mount under another module's mount point", async () => {
		await mountModules();
		await withSuppressedSlothletErrorOutput(async () => {
			expect(await api.supplier.attack.addUnderCallee(path.join(FIXTURE, "vault"))).not.toBe("undefined");
		});
		expect(api.callee.extra).toBeDefined();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.replaceCalleeMember()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
	});

	it("lets a module's own api.add, reload, and remove work below another module's mount point", async () => {
		await mountModules();
		await withSuppressedSlothletErrorOutput(async () => {
			expect(await api.supplier.attack.addReloadRemoveUnderCallee(path.join(FIXTURE, "vault"))).toEqual(["object", "object", "undefined"]);
		});
		expect(api.callee.extra).toBeUndefined();
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("lets a module's own api.add, reload, and remove work at another module's mount point", async () => {
		await mountModules();
		await withSuppressedSlothletErrorOutput(async () => {
			expect(await api.supplier.attack.addReloadRemoveUnderCallee(path.join(FIXTURE, "callee_peer"), "callee")).toEqual([
				"object",
				"object",
				"object"
			]);
		});
		expect(api.callee.peer).toBeUndefined();
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("installs a routine stack the framework builds for a module's own api.add below another module's mount point", async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode,
			runtime,
			silent: true,
			stackRoutines: true,
			routines: [{ name: "initialize", mode: "manual" }]
		});
		await api.slothlet.api.add("callee", path.join(FIXTURE, "callee"), { moduleID: "callee" });
		await api.slothlet.api.add("supplier", path.join(FIXTURE, "supplier"), { moduleID: "supplier" });
		await api.slothlet.api.add("callee.boot", path.join(FIXTURE, "routine_a"), { moduleID: "boot-a" });
		await api.supplier.attack.addAt("callee.boot", path.join(FIXTURE, "routine_b"), "boot-b");
		expect(api.callee.boot.initialize.__slothletRoutineStack).toBe(true);
		expect(await api.callee.boot.initialize()).toEqual(["a", "b"]);
	});

	it("checks the module's own code that runs while an api.add it started is still in flight", async () => {
		await mountModules();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.supplier.attack.addThenWrite(path.join(FIXTURE, "vault"))).rejects.toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("checks the module's own code resuming after an await while an api.add it started is in flight", async () => {
		await mountModules();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.supplier.attack.addThenWrite(path.join(FIXTURE, "vault"), true)).rejects.toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("checks the module's own code that runs while a failing api.remove it started is in flight", async () => {
		await mountModules();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.supplier.attack.failingRemoveThenWrite()).rejects.toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("checks another invocation of the same leaf while one of its api.add calls is in flight", async () => {
		await mountModules();
		await withSuppressedSlothletErrorOutput(async () => {
			const adding = api.supplier.attack.dual("add", path.join(FIXTURE, "vault"));
			await expect(api.supplier.attack.dual("write")).rejects.toThrow(/LOOSE_SET_NOT_OWNED/);
			await adding;
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("checks another module's writes while the host runs an api.add", async () => {
		await mountModules();
		let outcome;
		await withSuppressedSlothletErrorOutput(async () => {
			const lurking = api.supplier.attack.lurk();
			await api.slothlet.api.add("vault2", path.join(FIXTURE, "vault"), { moduleID: "vault2" });
			await api.slothlet.api.add("vault3", path.join(FIXTURE, "callee_peer"), { moduleID: "vault3" });
			api.supplier.attack.stopLurk();
			outcome = await lurking;
		});
		expect(outcome).toBe("refused");
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("refuses a module setting the prototype of another module's array member", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.protoOnCalleeList()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(api.callee.ops.list.injected).toBeUndefined();
		expect(Object.getPrototypeOf(api.callee.ops.list)).toBe(Array.prototype);
	});

	it("refuses a module setting the prototype of another module's namespace", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.protoOnCallee()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(api.callee.ops.injected).toBeUndefined();
	});

	it("refuses a module making another module's namespace non-extensible", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.preventExtensionsOnCallee()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(Object.isExtensible(api.callee.ops)).toBe(true);
		expect(await api.callee.ops.writeOwnNested("still-mine")).toBe("still-mine");
	});

	it("refuses a module freezing another module's namespace, leaving it unchanged", async () => {
		await mountModules();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.supplier.attack.freezeCallee()).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(Object.isExtensible(api.callee.ops)).toBe(true);
		expect(Object.isFrozen(api.callee.ops)).toBe(false);
		expect(await api.callee.ops.writeOwnNested("still-mine")).toBe("still-mine");
	});

	it("refuses a write through a nested node a module captured, made later with no active context", async () => {
		await mountModules();
		const later = await api.supplier.attack.captureCallee();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("refuses a write through a captured self made later with no active context (the top-level counterpart)", async () => {
		await mountModules();
		const later = await api.supplier.attack.captureSelf();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("lets a module write later, with no module executing, into its own node it read through self", async () => {
		await mountModules();
		const later = await api.callee.ops.deferOwnWrite();
		expect(later("written-later")).toBe("written-later");
		expect(api.callee.ops.later).toBe("written-later");
	});

	it("lets the host write through a node a module handed back from its own subtree", async () => {
		await mountModules();
		const node = await api.callee.ops.ownNode();
		node.hostNote = "through-the-owner";
		expect(api.callee.ops.hostNote).toBe("through-the-owner");
	});

	it("refuses the host writing through a node a module read from another module's subtree", async () => {
		await mountModules();
		const node = await api.supplier.attack.calleeNode();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => {
				node.useSecret = () => "pwned-through-host";
			}).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it.each([
		["Object.getOwnPropertyDescriptor", false],
		["Object.getOwnPropertyDescriptors", true]
	])("refuses a later write through a node a module took from %s", async (_name, all) => {
		await mountModules();
		const later = await api.supplier.attack.descriptorLeak(all);
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it.each([
		["synchronously", false],
		["asynchronously", true]
	])("refuses a later write through the receiver a method of another module hands back %s", async (_name, async) => {
		await mountModules();
		const later = await api.supplier.attack.thisLeak(async);
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("lets a method of another module keep its receiver and write its own node through it later", async () => {
		await mountModules();
		const later = await api.supplier.attack.keptOwnReceiver();
		expect(later("kept-later")).toBe("kept-later");
		expect(api.callee.ops.kept).toBe("kept-later");
	});

	it("refuses a later write through a third module's node a caller lends a method as its receiver", async () => {
		await mountModules();
		const later = await api.supplier.attack.borrowedReceiver();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(api.vault.secret.useSecret).toBeUndefined();
		expect(await api.vault.secret()).toBe("vault-secret");
	});

	it("hands a method its own node as it reads it through self as receiver and return value, and an argument as the caller passed it", async () => {
		await mountModules();
		expect(await api.supplier.attack.identityChecks()).toEqual([true, true, false]);
	});

	it.each([["box"], ["keep"], ["boxAsync"]])(
		"refuses a later write through another module's node passed to its method %s and taken back",
		async (how) => {
			await mountModules();
			const later = await api.supplier.attack.argLeak(how);
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
			});
			expect(await api.callee.ops.useSecret()).toBe("callee-original");
		}
	);

	it("refuses a later write through an argument of another module's method a hook captured", async () => {
		await mountModules({ hook: true });
		const later = await api.supplier.attack.hookLeak();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it.each([["boxThis"], ["callWith"]])(
		"refuses a later write through another node of a module a caller steers its method %s onto as the receiver",
		async (how) => {
			await mountModules();
			const later = await api.supplier.attack.steeredThisLeak(how);
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
			});
			expect(await api.callee.other.ping()).toBe("other");
		}
	);

	it("hands a method an argument as the caller passed it, so what it keeps or returns is what was passed", async () => {
		await mountModules();
		expect(await api.supplier.attack.argIdentity()).toEqual([true, true, true, true]);
	});

	it.each([["sync"], ["async"], ["thenable"]])("refuses a later write through another module's node it returned (%s)", async (how) => {
		await mountModules();
		const later = await api.supplier.attack.returnedNodeLeak(how);
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("lets a module write later through a node another module shared inside a returned object", async () => {
		await mountModules();
		const later = await api.supplier.attack.containerShare();
		expect(later("shared-later")).toBe("shared-later");
		expect(api.callee.ops.shared).toBe("shared-later");
	});

	it.each([
		["store", false],
		["store", true],
		["bus", false],
		["bus", true]
	])("refuses writes through the %s instance another module's method hands back as its receiver (async %s)", async (name, async) => {
		await mountModules();
		await api.slothlet.api.add("svc", path.join(FIXTURE, "svc"), { moduleID: "svc" });
		let outcome;
		await withSuppressedSlothletErrorOutput(async () => {
			outcome = await api.supplier.attack.instanceLeak(name, async);
		});
		expect(outcome.now).toBe("LOOSE_SET_NOT_OWNED");
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => outcome.later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.svc[name].read()).toBe(`${name}-secret`);
	});

	it.each([
		["run()", (callback) => api.slothlet.context.run({ request: "r1" }, callback)],
		["scope()", (callback) => api.slothlet.context.scope({ context: { request: "r1" }, fn: callback })]
	])("lets the host write a nested node through self inside %s", async (_name, enter) => {
		await mountModules();
		await enter(() => {
			self.hostTop = "top";
			self.callee.ops.hostNested = "nested";
		});
		expect(api.hostTop).toBe("top");
		expect(api.callee.ops.hostNested).toBe("nested");
	});

	it("refuses a later write through a node a module read once that module is removed", async () => {
		await mountModules();
		const later = await api.supplier.attack.captureCallee();
		await api.slothlet.api.remove("supplier");
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("refuses a write a module's call still in flight makes once the module is removed", async () => {
		await mountModules();
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const writing = api.supplier.attack.writeAfter(gate);
		await new Promise((resolve) => setTimeout(resolve, 0));
		await api.slothlet.api.remove("supplier");
		release();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(writing).rejects.toThrow(/LOOSE_SET_NOT_OWNED|LOOSE_SET_UNATTRIBUTED/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("holds a node a module read to its ownership across a reload", async () => {
		await mountModules();
		const foreign = await api.supplier.attack.captureCallee();
		const own = await api.callee.ops.deferOwnWrite();
		await api.slothlet.reload();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => foreign()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		// The module's own node stays writable to it. A full reload replaces an added module's nodes, so the
		// write lands on the node the module kept, as a write through a reference the host kept does.
		expect(own("after-reload")).toBe("after-reload");
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it("refuses later writes through nodes a module read before a restart, the same modules added again", async () => {
		await mountModules();
		const write = await api.supplier.attack.captureCallee();
		const borrow = await api.supplier.attack.captureBorrow();
		await api.slothlet.restart();
		await api.slothlet.api.add("callee", path.join(FIXTURE, "callee"), { moduleID: "callee" });
		await api.slothlet.api.add("vault", path.join(FIXTURE, "vault"), { moduleID: "vault" });
		await api.slothlet.api.add("supplier", path.join(FIXTURE, "supplier"), { moduleID: "supplier" });
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => write()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		for (const call of [borrow.member, borrow.method]) {
			const later = call();
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
			});
		}
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
		expect(api.vault.secret.useSecret).toBeUndefined();
	});

	it("hands a module the same node on every read through self", async () => {
		await mountModules();
		expect(await api.supplier.attack.sameNodeTwice()).toBe(true);
	});

	it("stores the node itself when a module stores what it read through self", async () => {
		await mountModules();
		await api.supplier.attack.storeCalleeRef();
		expect(api.supplier.ref).toBe(api.callee.ops);
		api.supplier.ref.hostNote = "through-the-stored-node";
		expect(api.callee.ops.hostNote).toBe("through-the-stored-node");
	});

	/**
	 * Mount the modules, `svc`, and `evil`, give `svc` a grafted object, and load every `svc` node.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function mountSideChannels(options = {}) {
		await mountModules(options);
		await api.slothlet.api.add("svc", path.join(FIXTURE, "svc"), { moduleID: "svc" });
		await api.slothlet.api.add("evil", path.join(FIXTURE, "evil"), { moduleID: "evil" });
		api.svc.state = {
			secret: "state-secret",
			read() {
				return this.secret;
			}
		};
		for (const name of ["store", "bus", "state"]) expect(await api.svc[name].read()).toBe(`${name}-secret`);
		return api;
	}

	it.each([
		["go", "store"],
		["go", "bus"],
		["go", "state"],
		["steer", "store"],
		["steer", "bus"],
		["steer", "state"]
	])("refuses a module's %s writing through another module's %s steered in as a receiver", async (how, name) => {
		await mountSideChannels();
		await withSuppressedSlothletErrorOutput(async () => {
			await expect((async () => api.evil.x[how](name))()).rejects.toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(await api.svc[name].read()).toBe(`${name}-secret`);
	});

	it.each([
		["before", "box", false],
		["before", "box", true],
		["after", "ownNode", false],
		["always", "ownNode", false],
		["around", "ownNode", false]
	])(
		"refuses later writes through what a module's %s hook on callee.ops.%s is handed (host argument: %s)",
		async (type, method, hostArg) => {
			await mountSideChannels({ hook: true });
			const hook = await api.evil.x.keepHook(`callee.ops.${method}`, type);
			const returned = await api.callee.ops[method](hostArg ? api.callee.ops : 1);
			const kept = hook.get();
			const targets = [kept.api.callee.ops];
			if (hostArg) targets.push(kept.args[0]);
			if (method === "ownNode") targets.push(await kept.result);
			withSuppressedSlothletErrorOutputSync(() => {
				for (const node of targets) {
					expect(() => {
						node.useSecret = () => "pwned-by-hook";
					}).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
				}
				expect(() => {
					kept.api.callee = { pwned: true };
				}).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
			});
			expect(await api.callee.ops.useSecret()).toBe("callee-original");
			// What the hook handed back unchanged is what the call returned: the host may still write through it.
			if (method === "ownNode") {
				returned.hostNote = "through-the-returned-node";
				expect(api.callee.ops.hostNote).toBe("through-the-returned-node");
			}
			// The module's own subtree stays writable to it through the hook's api.
			kept.api.evil.note = "own-later";
			expect(api.evil.note).toBe("own-later");
		}
	);

	it.each([["describe"], ["getAPI"]])("refuses a later write through another module's node a module took from diag.%s", async (how) => {
		await mountSideChannels({ diagnostics: true });
		const later = await api.evil.x.keepDiag(how);
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
		// The host still gets the api itself.
		expect(api.slothlet.diag.describe(true).callee).toBe(api.callee);
	});

	it.each([["impl:created"], ["impl:changed"]])(
		"refuses a later write through the impl %s hands a module that subscribed, a view of the node or null",
		async (event) => {
			await mountSideChannels();
			const subscription = await api.evil.x.keepLifecycle(event, "vault2");
			await api.slothlet.api.add("vault2", path.join(FIXTURE, "callee"), { moduleID: "vault2" });
			expect(await api.vault2.ops.useSecret()).toBe("callee-original");
			await api.slothlet.api.reload("vault2");
			expect(await api.vault2.ops.useSecret()).toBe("callee-original");
			await new Promise((resolve) => setTimeout(resolve, 0));
			const kept = subscription.get();
			expect(kept.length).toBeGreaterThan(0);
			// A node already in the tree (a reload's impl:changed) is handed over as the module's view of it.
			if (event === "impl:changed") expect(kept.some((impl) => impl !== null)).toBe(true);
			withSuppressedSlothletErrorOutputSync(() => {
				for (const impl of kept) {
					if (impl === null) continue;
					expect(() => {
						impl.useSecret = () => "pwned-by-lifecycle";
					}).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
				}
			});
			expect(await api.vault2.ops.useSecret()).toBe("callee-original");
		}
	);
	it.each([["a module's own nested write"], ["the host's api.add"]])(
		"runs a lifecycle subscriber a module subscribed as that module when %s fires the event",
		async (trigger) => {
			await mountSideChannels();
			const subscription = await api.evil.x.subscribeWriter();
			await withSuppressedSlothletErrorOutput(async () => {
				if (trigger === "the host's api.add") await api.slothlet.api.add("vault2", path.join(FIXTURE, "vault"), { moduleID: "vault2" });
				else await api.callee.ops.writeOwnNested(() => 1);
				await new Promise((resolve) => setTimeout(resolve, 0));
			});
			const outcomes = subscription.get();
			expect(outcomes.length).toBeGreaterThan(0);
			expect(outcomes.every((outcome) => outcome === "LOOSE_SET_NOT_OWNED")).toBe(true);
			expect(await api.callee.ops.useSecret()).toBe("callee-original");
		}
	);

	it.each([["before"], ["around"]])("pins a module's %s hook whose handler carries a forged _slothletOriginal", async (type) => {
		await mountSideChannels({ hook: true });
		const hook = await api.evil.x.forgedHook("callee.ops.writeOwnNested", type);
		await withSuppressedSlothletErrorOutput(async () => {
			await api.callee.ops.writeOwnNested("host-call");
		});
		expect(hook.get()).toEqual(["LOOSE_SET_NOT_OWNED"]);
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it.each([["kept"], ["inspect"], ["descriptor"], ["valueOf"]])(
		"refuses a later write through a version dispatcher a module read (%s)",
		async (how) => {
			await mountSideChannels();
			await api.slothlet.api.add("auth", path.join(TEST_DIRS.API_TEST_VERSIONED, "v1"), {}, { version: "v1", default: true });
			await api.slothlet.api.add("auth", path.join(TEST_DIRS.API_TEST_VERSIONED, "v2"), {}, { version: "v2" });
			const later = await api.evil.x.dispatcherLeak(how);
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
			});
			expect(api.v1.auth.login("a").version).toBe("v1");
			expect(api.auth.login("a").version).toBe("v1");
		}
	);

	it.each([["getAPI"], ["describe"]])("refuses a later write through a node a kept diag.%s hands back", async (how) => {
		await mountSideChannels({ diagnostics: true });
		const kept = await api.evil.x.keepFrameworkFn(how);
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => kept.later()).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it.each([["hook"], ["lifecycle"]])("registers as the module what a kept %s.on registers when the host calls it later", async (how) => {
		await mountSideChannels({ hook: true });
		const kept = await api.evil.x.keepFrameworkFn(how);
		kept.later();
		await withSuppressedSlothletErrorOutput(async () => {
			await api.callee.ops.writeOwnNested(how === "hook" ? "host-call" : () => 1);
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		const outcomes = kept.get();
		expect(outcomes.length).toBeGreaterThan(0);
		expect(outcomes.every((outcome) => outcome === "LOOSE_SET_NOT_OWNED")).toBe(true);
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});

	it.each([
		["before", "set", "box", { x: "mut" }],
		["before", "push", "count", 2],
		["around", "set", "box", { x: "mut" }],
		["around", "push", "count", 2]
	])("hands the call a change a module's %s hook makes to its args in place (%s)", async (type, how, method, expected) => {
		await mountSideChannels({ hook: true });
		await api.evil.x.mutateArgsHook(`callee.ops.${method}`, type, how);
		expect(await api.callee.ops[method]("orig")).toEqual(expected);
	});

	it("hands a module's error hook its own view of a node the call threw", async () => {
		await mountSideChannels({ hook: true });
		const hook = await api.evil.x.keepErrorHook("callee.ops.throwOwnNode");
		let thrown;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.callee.ops.throwOwnNode();
			} catch (error) {
				thrown = error;
			}
		});
		expect(thrown).toBeDefined();
		const kept = hook.get();
		expect(kept).toBeDefined();
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => {
				kept.useSecret = () => "pwned-by-error-hook";
			}).toThrow(/RUNTIME_NO_ACTIVE_CONTEXT_SELF/);
		});
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});
});

describe.each([
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
])("nested self assignment ownership (#625), unattributable live code — $mode", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * A promise and the function that releases it.
	 * @returns {[Promise<void>, Function]} Gate and release.
	 */
	function gate() {
		let release;
		const promise = new Promise((resolve) => (release = resolve));
		return [promise, release];
	}

	/**
	 * Let pending microtasks and one timer turn run.
	 * @returns {Promise<void>} Resolves on the next macrotask.
	 */
	const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

	it("refuses a write the live runtime cannot attribute to one call, rather than taking the store's last caller", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, runtime, silent: true });
		await api.slothlet.api.add("callee", path.join(FIXTURE, "callee"), { moduleID: "callee" });
		await api.slothlet.api.add("twin", path.join(FIXTURE, "twin"), { moduleID: "twin" });
		const [goGate, releaseGo] = gate();
		const [peerGate, releasePeer] = gate();
		const [holdGate, releaseHold] = gate();
		// twin.go resumes in resume.mjs, which twin.peer imports too, while both are suspended: the stack
		// cannot tell them apart. callee.ops.hold, entered last, is what the store's own field names.
		const going = api.twin.go(goGate);
		await turn();
		const waiting = api.twin.peer.wait(peerGate);
		await turn();
		const holding = api.callee.ops.hold(holdGate);
		await turn();
		releaseGo();
		expect(await going).toBe("LOOSE_SET_UNATTRIBUTED");
		releasePeer();
		releaseHold();
		expect(await waiting).toBe("waited");
		expect(await holding).toBe("held");
		expect(await api.callee.ops.useSecret()).toBe("callee-original");
	});
});
