/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-write-rules-host-only.test.vitest.mjs
 *	@Date: 2026-10-18T18:47:58-07:00 (1792374478)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T19:52:16-07:00 (1792378336)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Only the host lifts a built-in write rule (#625).
 *
 * The built-in write rules (`slothlet.**:write`, `**.__metadata:write`, …) keep every module off the framework's
 * namespace and the framework's own keys on api nodes, with or without a permissions config. A rule granting a
 * write can only ever lift a denial — the ownership rule still applies to what it lets through — so a grant is
 * the host's to make. A module's manifest that grants a write is refused at mount, and module code adding such a
 * rule at runtime, directly or through the options of an `api.add` it makes, is refused too. The host still lifts
 * a built-in rule with a rule of its own.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/` (owns the whole tree), `victim/`, and the module
 * `modules/lifter`, whose manifest grants writes to `slothlet.**` and `**.__metadata`.
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
	{ label: "no permissions config", options: {} },
	{ label: "permissions with defaults", options: { permissions: {} } },
	{ label: "permissions defaultPolicy deny", options: { permissions: { defaultPolicy: "deny", rules: [CALL_NAMESPACE] } } }
];

describe.each(CONFIGS)("built-in write rules are lifted only by the host (#625) — $mode / $runtime", ({ mode, runtime }) => {
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

		it("refuses mounting a module whose manifest grants writes", async () => {
			await load();
			let caught = null;
			await withSuppressedSlothletErrorOutput(async () => {
				try {
					await api.slothlet.api.modules.addModule("@local/lifter", { discover: { scanRoot: path.join(FIXTURE, "modules") } });
				} catch (error) {
					caught = error;
				}
			});
			expect(caught?.code).toBe("MODULE_MANIFEST_INVALID");
			expect(caught.message).toContain("permissions[0]");
			expect(api.lifter).toBeUndefined();
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
			expect(api.slothlet.lifted).toBeUndefined();
		});

		it("refuses module code adding a rule that grants writes", async () => {
			await load();
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.grantByRule())).toBe("INVALID_PERMISSION_RULE");
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
			expect(api.slothlet.lifted).toBeUndefined();
		});

		it("refuses module code mounting a folder with a rule that grants writes", async () => {
			await load();
			expect(await withSuppressedSlothletErrorOutput(() => api.root.grantByAdd(path.join(FIXTURE, "victim")))).toBe("INVALID_PERMISSION_RULE");
			expect(api.granted).toBeUndefined();
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
		});

		it("lets module code add rules that grant no write", async () => {
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
	});
});

describe.each([
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
])("built-in write rules are lifted only by the host (#625), unattributable live code — $mode", ({ mode, runtime }) => {
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

	it("refuses a write grant from code the live runtime cannot attribute to one call", async () => {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true });
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
