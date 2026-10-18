/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-nested-ownership.test.vitest.mjs
 *	@Date: 2026-10-17T21:13:18-07:00 (1792296798)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T21:23:55-07:00 (1792297435)
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
});
