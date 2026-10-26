/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-framework-write-rules.test.vitest.mjs
 *	@Date: 2026-10-18T18:47:58-07:00 (1792374478)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T02:52:47-07:00 (1793008367)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Who lifts the built-in write rules (#625).
 *
 * The built-in write rules (`slothlet.**:write`, `**.__metadata:write`, …) keep every module off the framework's
 * namespace and the framework's own keys on api nodes while the permission system is on. They are defaults:
 * the host lifts one with a rule of its own, and so does a module's manifest — mounting it is the consumer's
 * choice. Module code may not lift one through `addRule` or the options of an `api.add` it makes, even the base
 * module, which owns the rest of the tree, unless the host or its manifest let it manage rules beyond its subtree.
 * A lifted write still meets the ownership rule. With the system off no rule decides a write, a lift included: the
 * base module, which owns the whole tree, writes the namespace, a module owning none of it does not, and rule
 * registration keeps its limits.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/` (owns the whole tree), `victim/`, and the module
 * `modules/lifter`, whose manifest allows writes to `slothlet.**` and `**.__metadata`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

// Under `defaultPolicy: "deny"` the host lets the base module call the namespace, so the write grant itself is what is refused.
const CALL_NAMESPACE = { caller: "**", target: "slothlet.**", effect: "allow" };
const PERMISSIONS = [
	{ label: "permissions with defaults", options: { permissions: {} } },
	{ label: "permissions defaultPolicy deny", options: { permissions: { defaultPolicy: "deny", rules: [CALL_NAMESPACE] } } }
];

describe.each(CONFIGS)("lifting the built-in write rules (#625) — $mode / $runtime", ({ mode, runtime }) => {
	describe.each(PERMISSIONS)("$label", ({ options }) => {
		let api;

		afterEach(async () => {
			if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the base module and mount `victim` beside it.
		 * @returns {Promise<object>} The composed api.
		 */
		async function load() {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
			await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
			return api;
		}

		it("lets a module's manifest lift a built-in write rule", async () => {
			await load();
			await api.slothlet.api.modules.addModule("@local/lifter", { discover: { scanRoot: path.join(FIXTURE, "modules", "lifter") } });
			expect(api.lifter.info.name()).toBe("lifter");
			expect(await api.root.writeNamespace()).toBe("done");
			expect(api.slothlet.lifted).toBe(1);
		});

		it("lets a manifest's lift grant the write to a module that owns none of the namespace", async () => {
			await load();
			await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeNamespaceMember("lifted", 2))).toBe("PERMISSION_DENIED");
			await api.slothlet.api.modules.addModule("@local/lifter", { discover: { scanRoot: path.join(FIXTURE, "modules", "lifter") } });
			expect(await api.guest.x.writeNamespaceMember("lifted", 2)).toBe("done");
			expect(api.slothlet.lifted).toBe(2);
		});

		it("refuses module code lifting a built-in write rule with addRule", async () => {
			await load();
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.grantByRule())).toBe("INVALID_PERMISSION_RULE");
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
			expect(api.slothlet.lifted).toBeUndefined();
		});

		it("refuses module code lifting a built-in write rule through the options of an api.add", async () => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.root.grantByAdd(path.join(FIXTURE, "victim")))).toBe(
				"INVALID_PERMISSION_RULE"
			);
			expect(api.granted).toBeUndefined();
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
		});

		it("lets base-module code add rules for the tree it owns", async () => {
			await load();
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.addOtherRules())).toEqual({
				deny: "done",
				call: "done",
				malformed: "INVALID_PERMISSION_RULE"
			});
		});

		it("lets the host lift a built-in write rule with a rule of its own", async () => {
			await load();
			api.slothlet.permissions.addRule({ caller: "**", target: "slothlet.lifted:write", effect: "allow" });
			expect(await api.root.writeNamespace()).toBe("done");
			expect(api.slothlet.lifted).toBe(1);
		});

		it("lets a manifest's lift grant the write to a module that owns none of the namespace", async () => {
			await load();
			await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeNamespaceMember("lifted", 2))).toBe("PERMISSION_DENIED");
			await api.slothlet.api.modules.addModule("@local/lifter", { discover: { scanRoot: path.join(FIXTURE, "modules", "lifter") } });
			expect(await api.guest.x.writeNamespaceMember("lifted", 2)).toBe("done");
			expect(api.slothlet.lifted).toBe(2);
		});
	});
});

describe.each(CONFIGS)("the built-in write rules with the permission system off (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module with no permissions config, and mount `victim` and `guest` beside it.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load() {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true });
		await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
		return api;
	}

	it("lets base-module code and a module mounted with api.add write the namespace: nothing decides writes", async () => {
		await load();
		expect(api.root.writeNamespace()).toBe("done");
		expect(api.slothlet.lifted).toBe(1);
		expect(api.guest.x.writeNamespaceMember("lifted", 2)).toBe("done");
		expect(api.slothlet.lifted).toBe(2);
	});

	it("keeps module code from adding a rule that lifts a built-in write rule", async () => {
		await load();
		expect(withSuppressedSlothletErrorOutputSync(() => api.root.grantByRule())).toBe("INVALID_PERMISSION_RULE");
		expect(await withSuppressedSlothletErrorOutput(() => api.root.grantByAdd(path.join(FIXTURE, "victim")))).toBe(
			"INVALID_PERMISSION_RULE"
		);
		expect(api.granted).toBeUndefined();
	});
});

describe.each([
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
])("lifting the built-in write rules (#625), unattributable live code — $mode", ({ mode, runtime }) => {
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

	it("refuses a rule from code the live runtime cannot attribute to one call", async () => {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions: {} });
		await api.slothlet.api.add("twin", path.join(FIXTURE, "twin"), { moduleID: "twin" });
		const [goGate, releaseGo] = gate();
		const [peerGate, releasePeer] = gate();
		// twin.go resumes in resume.mjs, which twin.peer imports too, while both are suspended.
		const going = api.twin.go(goGate);
		await turn();
		const waiting = api.twin.peer.wait(peerGate);
		await turn();
		releaseGo();
		// The framework's call gate refuses code it cannot attribute before the grant is even looked at.
		expect(await withSuppressedSlothletErrorOutput(() => going)).toBe("PERMISSION_DENIED");
		releasePeer();
		expect(await waiting).toBe("waited");
		expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
	});
});
