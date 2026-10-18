/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-nested-ownership.test.vitest.mjs
 *	@Date: 2026-10-17T21:13:18-07:00 (1792296798)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T23:33:32-07:00 (1792305212)
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
 * Fixture: `api_tests/api_test_nested_self_assign` — `callee/`, `vault/`, `supplier/`, `callee_peer/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
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
	 * @returns {Promise<object>} The composed api.
	 */
	async function mountModules() {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, runtime, silent: true });
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
});
