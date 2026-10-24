/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-write-system-off.test.vitest.mjs
 *	@Date: 2026-10-19T10:43:29-07:00 (1792431809)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-19T11:34:45-07:00 (1792434885)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview With the permission system off, no permission rule decides a write; ownership still does (#625).
 *
 * The permission system is off with no `permissions` config, with `enabled: false`, and after `control.disable()`.
 * Then neither the built-in write rules (the framework's namespace and root functions) nor a `:write` rule refuses
 * or grants anything, and a module writes exactly what it owns: base-module code owns the whole tree, as in the
 * released 3.x line, and a module an `api.add` mounted owns its own subtree only. Rule registration keeps its
 * limits, and a rule a module registers while the system is off takes effect once the host turns it on.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/` (base-module code), `victim/`, and `guest/` (also
 * mounted as `other`).
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GUEST = path.join(FIXTURE, "guest");
const VICTIM = path.join(FIXTURE, "victim");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * The report expected when every change has the same outcome.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The same keys, each `outcome`.
 */
const every = (report, outcome) => Object.fromEntries(Object.keys(report).map((key) => [key, outcome]));

/** A rule granting `guest` writes into the victim. */
const GRANT = { caller: "guest.**", target: "victim.**:write", effect: "allow" };

describe.each(CONFIGS)("writes with the permission system off (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim`, and the guest code at `guest` and `other`.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = {}) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", VICTIM, { moduleID: "victim" });
		for (const name of ["guest", "other"]) await api.slothlet.api.add(name, GUEST, { moduleID: name });
		return api;
	}

	describe.each([
		["no permissions config", {}],
		["enabled: false", { permissions: { enabled: false, rules: [GRANT] } }]
	])("with %s", (_label, options) => {
		it("lets base-module code write the framework namespace", async () => {
			await load(options);
			expect(api.root.writeNamespace()).toBe("done");
			expect(api.slothlet.lifted).toBe(1);
		});

		it("holds a module an api.add mounted to what it owns", async () => {
			await load(options);
			const framework = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("slothlet.metadata"));
			expect(framework).toEqual(every(framework, "LOOSE_SET_NOT_OWNED"));
			const victim = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(victim).toEqual(every(victim, "LOOSE_SET_NOT_OWNED"));
			const own = api.guest.x.writeAt("guest.x");
			expect(own).toEqual(every(own, "done"));
		});

		it("keeps rule registration limited, and applies a module's rule once the host turns the system on", async () => {
			await load(options);
			expect(
				withSuppressedSlothletErrorOutputSync(() =>
					api.guest.x.addRuleFor({ caller: "guest.**", target: "victim.**:write", effect: "allow" })
				)
			).toBe("INVALID_PERMISSION_RULE");
			expect(typeof api.guest.x.addRuleFor({ caller: "other.**", target: "guest.**:write", effect: "allow" })).toBe("string");
			const off = withSuppressedSlothletErrorOutputSync(() => api.other.x.writeAt("guest.x"));
			expect(off).toEqual(every(off, "LOOSE_SET_NOT_OWNED"));
			api.slothlet.permissions.control.enable();
			const on = api.other.x.writeAt("guest.x");
			expect(on).toEqual(every(on, "done"));
		});
	});

	describe("with the system on", () => {
		it("refuses base-module code and modules the framework namespace, and grants by rule", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [GRANT] } });
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
			expect(api.slothlet.lifted).toBeUndefined();
			const framework = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("slothlet.metadata"));
			expect(framework).toEqual(every(framework, "PERMISSION_DENIED"));
			const granted = api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
		});

		it("stops deciding writes after control.disable(), and decides them again after control.enable()", async () => {
			await load({ permissions: { defaultPolicy: "allow", rules: [GRANT] } });
			api.slothlet.permissions.control.disable();
			expect(api.root.writeNamespace()).toBe("done");
			const ungranted = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("victim.v"));
			expect(ungranted).toEqual(every(ungranted, "LOOSE_SET_NOT_OWNED"));
			api.slothlet.permissions.control.enable();
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
			const granted = api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
		});
	});
});
