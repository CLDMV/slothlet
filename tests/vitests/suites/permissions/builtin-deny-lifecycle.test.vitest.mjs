/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/builtin-deny-lifecycle.test.vitest.mjs
 *	@Date: 2026-09-28T22:30:00-07:00 (1790659800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:13-07:00 (1791090913)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Built-in deny rules for the lifecycle surface (#529).
 *
 * @description
 * With a `permissions` config:
 * - `slothlet.reload` and `slothlet.shutdown` — the framework's own methods — are always denied to
 *   modules by built-in rules.
 * - The root path of each DEFAULT routine (`initialize` → startup, `shutdown` → shutdown) is denied to
 *   modules only while that default is in the effective `routines` config (matched on name and mode).
 *   With `routines: []` or the default replaced, those paths are ordinary routines with no built-in
 *   rule — though the root `api.shutdown()` still tears the instance down, so a host wanting that
 *   protection adds its own rule.
 * The host is never gated, an explicit allow re-opens each target, framework-internal teardown is not
 * refused midway, and with no `permissions` config (enforcement off) everything is reachable.
 */

import path from "node:path";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_lifecycle_gate");

/**
 * Module-side calls and the built-in target each is gated by under the default routines.
 * @type {Array<{label: string, call: Function, target: string}>}
 */
const GATED = [
	{ label: "self.slothlet.reload()", call: (api) => api.caller.nsReload(), target: "slothlet.reload" },
	{ label: "self.slothlet.shutdown()", call: (api) => api.caller.nsShutdown(), target: "slothlet.shutdown" },
	{ label: "root self.shutdown()", call: (api) => api.caller.rootShutdown(), target: "shutdown" },
	{ label: "root self.initialize()", call: (api) => api.caller.callRoot("initialize"), target: "initialize" }
];

/**
 * Permission configs under which the built-ins apply.
 * @type {Array<{label: string, permissions: object}>}
 */
const POLICIES = [
	{ label: "defaultPolicy allow", permissions: { defaultPolicy: "allow" } },
	{ label: "defaultPolicy deny", permissions: { defaultPolicy: "deny" } }
];

/**
 * Run a call that may throw synchronously (eager) or reject (lazy) as a promise either way.
 * @param {Function} fn - The call.
 * @returns {Promise<unknown>} Its settled result.
 */
function settle(fn) {
	return Promise.resolve().then(fn);
}

/**
 * The fixture's call log (user routine contributions record themselves here).
 * @returns {string[]} The log.
 */
function log() {
	return globalThis.__slothletLifecycleGateLog;
}

describe.each(getMatrixConfigs({}))("Permissions > built-in deny for the lifecycle surface (#529) > $name", ({ config }) => {
	let api;

	beforeEach(() => {
		globalThis.__slothletLifecycleGateLog = [];
	});

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown().catch(() => {});
		api = null;
	});

	/**
	 * Boot the fixture api for the current matrix config.
	 * @param {object} [overrides] - Extra config.
	 * @returns {Promise<object>} The api.
	 */
	async function create(overrides = {}) {
		api = await slothlet({ ...config, base: BASE, silent: true, diagnostics: true, ...overrides });
		return api;
	}

	/**
	 * Whether the instance is still up.
	 * @returns {boolean} `isLoaded` from diagnostics.
	 */
	function isLoaded() {
		return api.slothlet.diag.inspect().isLoaded;
	}

	/**
	 * Assert the two framework methods are denied to the `caller` module and the instance is untouched.
	 * @returns {Promise<void>}
	 */
	async function expectFrameworkMethodsDenied() {
		const before = api.slothlet.instanceID;
		await expect(settle(() => api.caller.nsReload())).rejects.toThrow("PERMISSION_DENIED");
		await expect(settle(() => api.caller.nsShutdown())).rejects.toThrow("PERMISSION_DENIED");
		expect(api.slothlet.instanceID).toBe(before);
		expect(isLoaded()).toBe(true);
	}

	for (const { label: policy, permissions } of POLICIES) {
		for (const { label, call, target } of GATED) {
			it(`denies a module ${label} (${target}) with the default routines under ${policy}`, async () => {
				await create({ permissions });
				const before = api.slothlet.instanceID;
				await expect(settle(() => call(api))).rejects.toThrow("PERMISSION_DENIED");
				expect(api.slothlet.instanceID).toBe(before);
				expect(isLoaded()).toBe(true);
				expect(await api.target.ping()).toBe("pong");
			});

			it(`re-opens ${label} for a module with an explicit allow on ${target} under ${policy}`, async () => {
				await create({ permissions: { ...permissions, rules: [{ caller: "caller.**", target, effect: "allow" }] } });
				const before = api.slothlet.instanceID;
				await call(api);
				if (target === "slothlet.reload") {
					expect(api.slothlet.instanceID).not.toBe(before);
				} else if (target === "initialize") {
					expect(log()).toContain("user:initialize");
					expect(isLoaded()).toBe(true);
				} else {
					expect(isLoaded()).toBe(false);
				}
			});
		}
	}

	it("does not gate the host", async () => {
		await create({ permissions: { defaultPolicy: "deny" } });
		const before = api.slothlet.instanceID;
		await api.slothlet.reload();
		expect(api.slothlet.instanceID).not.toBe(before);
		await api.initialize();
		expect(log()).toContain("user:initialize");
		await api.slothlet.shutdown();
		expect(isLoaded()).toBe(false);
		await api.slothlet.reload();
		await api.shutdown();
		expect(isLoaded()).toBe(false);
	});

	for (const { label, call, target } of GATED) {
		it(`leaves ${label} reachable from a module with no permissions config (built-ins inert)`, async () => {
			await create();
			const before = api.slothlet.instanceID;
			await call(api);
			if (target === "slothlet.reload") {
				expect(api.slothlet.instanceID).not.toBe(before);
			} else if (target === "initialize") {
				expect(log()).toContain("user:initialize");
			} else {
				expect(isLoaded()).toBe(false);
			}
		});
	}

	it("with routines: [] the root shutdown is an ordinary path: a module's call tears the instance down; slothlet.* stays denied", async () => {
		await create({ permissions: { defaultPolicy: "allow" }, routines: [] });
		await expectFrameworkMethodsDenied();
		await api.caller.rootShutdown();
		// No built-in deny — and the root shutdown is still wired to the internal teardown.
		expect(isLoaded()).toBe(false);
		await expect(settle(() => api.target.ping())).rejects.toThrow("CONTEXT_NOT_FOUND");
	});

	it("with routines: [] a host rule on `shutdown` blocks a module's root shutdown", async () => {
		await create({
			permissions: { defaultPolicy: "allow", rules: [{ caller: "caller.**", target: "shutdown", effect: "deny" }] },
			routines: []
		});
		await expect(settle(() => api.caller.rootShutdown())).rejects.toThrow("PERMISSION_DENIED");
		expect(isLoaded()).toBe(true);
		expect(await api.target.ping()).toBe("pong");
	});

	it("with the shutdown default replaced by a renamed shutdown-mode routine, the root paths are ordinary routines", async () => {
		await create({ permissions: { defaultPolicy: "allow" }, routines: [{ name: "teardown", mode: "shutdown" }] });
		await expectFrameworkMethodsDenied();
		await api.caller.callRoot("teardown");
		expect(log()).toContain("user:teardown");
		await api.caller.rootShutdown();
		expect(isLoaded()).toBe(false);
	});

	it("does not refuse framework-internal teardown midway: a module's destroy() runs the user's shutdown", async () => {
		await create({ permissions: { defaultPolicy: "allow" } });
		await api.caller.rootDestroy();
		expect(log()).toContain("user:shutdown");
		expect(api.target).toBeUndefined();
		api = null;
	});
});
