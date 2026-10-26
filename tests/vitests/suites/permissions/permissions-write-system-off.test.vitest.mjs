/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-write-system-off.test.vitest.mjs
 *	@Date: 2026-10-19T10:43:29-07:00 (1792431809)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T16:16:11-07:00 (1793056571)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview With the permission system off, only the framework's own namespace is kept from module code (#625).
 *
 * The permission system is off with no `permissions` config, with `enabled: false` (or `mode: "off"`), and after
 * `control.disable()`. Then no `:write` rule refuses or grants anything and ownership refuses nothing: base-module
 * code and a module an `api.add` mounted write anywhere, except the framework's namespace and root functions, which
 * the built-in write rules keep from module code in every mode but `mode: "disabled"`. Disabled, nothing is checked.
 * Rule registration keeps its limits, and a rule a module registers while the system is off takes effect once the
 * host turns it on.
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
		["no permissions config", {}, "PERMISSION_DENIED"],
		["enabled: false", { permissions: { enabled: false, rules: [GRANT] } }, "PERMISSION_DENIED"],
		["mode: disabled", { permissions: { mode: "disabled", rules: [GRANT] } }, "done"]
	])("with %s", (_label, options, framework) => {
		it("keeps base-module code off the framework namespace unless the system is disabled", async () => {
			await load(options);
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe(framework);
			expect(api.slothlet.lifted).toBe(framework === "done" ? 1 : undefined);
		});

		it("lets a module an api.add mounted write anywhere but the framework namespace: what it owns is not checked", async () => {
			await load(options);
			const namespace = withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeAt("slothlet.metadata"));
			expect(namespace).toEqual(every(namespace, framework));
			const victim = api.guest.x.writeAt("victim.v");
			expect(victim).toEqual(every(victim, "done"));
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
			const off = api.other.x.writeAt("victim.v");
			expect(off).toEqual(every(off, "done"));
			api.slothlet.permissions.control.enable();
			const on = api.other.x.writeAt("guest.x");
			expect(on).toEqual(every(on, "done"));
			const ungranted = withSuppressedSlothletErrorOutputSync(() => api.other.x.writeAt("victim.v"));
			expect(ungranted).toEqual(every(ungranted, "LOOSE_SET_NOT_OWNED"));
		});
	});

	describe("with the system on", () => {
		it("reports its mode, and moves between on and off from the host", async () => {
			await load({ permissions: { defaultPolicy: "allow" } });
			expect(api.slothlet.permissions.control.mode).toBe("on");
			api.slothlet.permissions.control.disable();
			expect(api.slothlet.permissions.control.mode).toBe("off");
			api.slothlet.permissions.control.enable();
			expect(api.slothlet.permissions.control.mode).toBe("on");
		});

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
			// Off, the framework namespace is still kept from module code; ownership and `:write` rules are not checked.
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
			const ungranted = api.other.x.writeAt("victim.v");
			expect(ungranted).toEqual(every(ungranted, "done"));
			api.slothlet.permissions.control.enable();
			const refused = withSuppressedSlothletErrorOutputSync(() => api.other.x.writeAt("victim.v"));
			expect(refused).toEqual(every(refused, "LOOSE_SET_NOT_OWNED"));
			expect(withSuppressedSlothletErrorOutputSync(() => api.root.writeNamespace())).toBe("PERMISSION_DENIED");
			const granted = api.guest.x.writeAt("victim.v");
			expect(granted).toEqual(every(granted, "done"));
		});
	});
});
