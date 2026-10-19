/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-framework-namespace.test.vitest.mjs
 *	@Date: 2026-10-18T15:35:35-07:00 (1792362935)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T19:52:19-07:00 (1792378339)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module cannot change the framework namespace `self.slothlet` (#625).
 *
 * `self.slothlet` (and the root functions `self.shutdown` / `self.destroy`) belong to the framework and are
 * shared by every module and the host. A module used to be able to replace, define, or delete any member of
 * the namespace, or the namespace itself, and every other caller — the host included — then saw its fake.
 * The built-in write rules of the permission system (`slothlet:write`, `slothlet.**:write`, and the same for
 * `shutdown` / `destroy`) refuse every such change, at any depth, with `PERMISSION_DENIED`: for the base
 * module, which owns the rest of the tree, and for a module mounted with `api.add`; with no `permissions`
 * config at all, with one using the defaults, and with `defaultPolicy: "deny"`; in all four mode / runtime
 * configurations. Reading and calling the namespace, and the host changing it, stay as they were, and a
 * host rule can still lift the built-in one, as it can any built-in rule.
 *
 * Fixture: `api_tests/api_test_framework_namespace_guard` — `base/` and `guest/` both run `shared/attacks.mjs`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_FRAMEWORK_NAMESPACE_GUARD;
const REFUSED = "PERMISSION_DENIED";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

// A host read rule keeps the namespace readable under `defaultPolicy: "deny"`; it says nothing about writes.
const READ_NAMESPACE = { caller: "**", target: "slothlet.**", effect: "allow" };
const PERMISSIONS = [
	{ label: "no permissions config", options: {} },
	{ label: "permissions with defaults", options: { permissions: {} } },
	{ label: "permissions defaultPolicy deny", options: { permissions: { defaultPolicy: "deny", rules: [READ_NAMESPACE] } } }
];

const MEMBERS = ["lockCaller", "bind", "metadata", "hook", "event", "permissions", "api", "reload", "version"];

/**
 * A report with every refused change marked `"refused"`, so a change that went through stands out.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string[]} refusals - The error codes that count as a refusal.
 * @returns {Record<string, string>} The report with each refusal replaced by `"refused"`.
 */
const markRefused = (report, refusals) =>
	Object.fromEntries(Object.entries(report).map(([key, outcome]) => [key, refusals.includes(outcome) ? "refused" : outcome]));

/**
 * The report expected when every change is refused.
 * @param {Record<string, string>} report - Outcomes by change.
 * @returns {Record<string, string>} The same keys, each `"refused"`.
 */
const allRefused = (report) => Object.fromEntries(Object.keys(report).map((key) => [key, "refused"]));

describe.each(CONFIGS)("module writes to the framework namespace (#625) — $mode / $runtime", ({ mode, runtime }) => {
	describe.each(PERMISSIONS)("$label", ({ options }) => {
		const refusals = [REFUSED];
		let api;

		afterEach(async () => {
			if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the base module and mount the guest module beside it.
		 * @returns {Promise<object>} The composed api.
		 */
		async function load() {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
			await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
			return api;
		}

		/**
		 * The two modules, as the attack code is reached through each.
		 * @returns {Array<[string, object]>} Label and attack node.
		 */
		const modules = () => [
			["base module", api.attack],
			["guest module", api.guest.attack]
		];

		it("refuses replacing, defining, or deleting a member of self.slothlet", async () => {
			await load();
			const before = Object.fromEntries(MEMBERS.map((name) => [name, api.slothlet[name]]));
			for (const [label, attack] of modules()) {
				for (const name of MEMBERS) {
					const report = await withSuppressedSlothletErrorOutputSync(() => attack.changeMember(name));
					expect({ label, name, report: markRefused(report, refusals) }).toEqual({ label, name, report: allRefused(report) });
					expect(api.slothlet[name]).toBe(before[name]);
				}
			}
		});

		it("refuses changing self.slothlet itself", async () => {
			await load();
			const namespace = api.slothlet;
			const proto = Object.getPrototypeOf(namespace);
			for (const [label, attack] of modules()) {
				const report = await withSuppressedSlothletErrorOutputSync(() => attack.changeNamespace());
				expect({ label, report: markRefused(report, refusals) }).toEqual({ label, report: allRefused(report) });
			}
			expect(api.slothlet).toBe(namespace);
			expect(Object.getPrototypeOf(api.slothlet)).toBe(proto);
			expect(Object.isExtensible(api.slothlet)).toBe(true);
			expect(Object.isFrozen(api.slothlet)).toBe(false);
		});

		it("refuses changes at any depth under self.slothlet", async () => {
			await load();
			const caller = api.slothlet.lockCaller.caller;
			const addRule = api.slothlet.permissions.addRule;
			const on = api.slothlet.hook.on;
			const add = api.slothlet.api.add;
			const metadataProto = Object.getPrototypeOf(api.slothlet.metadata);
			const materializeGet = api.slothlet.materialize.get;
			const symbol = Symbol.for("slothlet.test.i625.namespace");
			for (const [label, attack] of modules()) {
				const report = await withSuppressedSlothletErrorOutputSync(() => attack.changeNested());
				expect({ label, report: markRefused(report, refusals) }).toEqual({ label, report: allRefused(report) });
			}
			expect(api.slothlet.lockCaller.caller).toBe(caller);
			expect(api.slothlet.permissions.addRule).toBe(addRule);
			expect(api.slothlet.permissions.planted).toBeUndefined();
			expect(api.slothlet.hook.on).toBe(on);
			expect(Object.isFrozen(api.slothlet.hook)).toBe(false);
			expect(api.slothlet.api.add).toBe(add);
			expect(Object.getPrototypeOf(api.slothlet.metadata)).toBe(metadataProto);
			expect(api.slothlet.materialize.get).toBe(materializeGet);
			expect(api.slothlet.materialize.get.planted).toBeUndefined();
			expect(Object.getPrototypeOf(api.slothlet.materialize.get)).toBe(Function.prototype);
			expect(api.slothlet.materialize.wait.planted).toBeUndefined();
			expect(Object.getOwnPropertyDescriptor(api.slothlet.materialize, "materialized").get.planted).toBeUndefined();
			expect(api.slothlet.permissions[symbol]).toBeUndefined();
		});

		it("refuses a module planting a setter accessor on self.slothlet.permissions", async () => {
			await load();
			for (const [label, attack] of modules()) {
				const outcome = withSuppressedSlothletErrorOutputSync(() => attack.plantPermissionsSetter());
				expect({ label, outcome }).toEqual({ label, outcome: REFUSED });
			}
			expect(Object.getOwnPropertyDescriptor(api.slothlet.permissions, "__syntheticSetter")).toBeUndefined();
		});

		it("refuses changing self.shutdown and self.destroy", async () => {
			await load();
			const shutdown = api.shutdown;
			const destroy = api.destroy;
			for (const [label, attack] of modules()) {
				const report = await withSuppressedSlothletErrorOutputSync(() => attack.changeRootFunctions());
				expect({ label, report: markRefused(report, refusals) }).toEqual({ label, report: allRefused(report) });
			}
			expect(api.shutdown).toBe(shutdown);
			expect(api.destroy).toBe(destroy);
			expect(api.shutdown.planted).toBeUndefined();
			expect(api.shutdown[Symbol.for("slothlet.test.i625.namespace")]).toBeUndefined();
		});

		it("runs a kept self.slothlet.materialize.get as the module that read it", async () => {
			if (!options.permissions) return;
			await load();
			for (const [label, attack, caller] of [
				["base module", api.attack, "attack.**"],
				["guest module", api.guest.attack, "guest.**"]
			]) {
				const kept = await attack.keepMaterializeGet();
				expect(typeof kept()).toBe("object");
				api.slothlet.permissions.addRule({ caller, target: "slothlet.materialize.get", effect: "deny" });
				let code = null;
				withSuppressedSlothletErrorOutputSync(() => {
					try {
						kept();
					} catch (error) {
						code = error?.code;
					}
				});
				expect({ label, code }).toEqual({ label, code: REFUSED });
			}
			expect(typeof api.slothlet.materialize.get()).toBe("object");
		});

		it("refuses a write through a namespace a module kept, made later from outside any call", async () => {
			await load();
			const lockCaller = api.slothlet.lockCaller;
			const on = api.slothlet.hook.on;
			for (const [label, attack] of modules()) {
				const later = await attack.keepNamespace();
				const report = withSuppressedSlothletErrorOutputSync(() => later());
				expect({ label, report: markRefused(report, refusals) }).toEqual({ label, report: allRefused(report) });
			}
			expect(api.slothlet.lockCaller).toBe(lockCaller);
			expect(api.slothlet.hook.on).toBe(on);
			expect(typeof api.slothlet.version).toBe("string");
		});

		it("still lets a module read and call self.slothlet", async () => {
			await load();
			for (const [, attack] of modules()) {
				const read = await attack.readAndCall();
				expect(read).toEqual({
					version: api.slothlet.version,
					lockCaller: "function",
					has: true,
					ownLockCaller: "function",
					hooks: true
				});
			}
		});

		it("lets a host rule lift the built-in write rule, ownership still applying", async () => {
			if (!options.permissions) return;
			const grant = { caller: "**", target: "slothlet.hostGranted:write", effect: "allow" };
			api = await slothlet({
				base: path.join(FIXTURE, "base"),
				mode,
				runtime,
				silent: true,
				permissions: { ...options.permissions, rules: [...(options.permissions.rules ?? []), grant] }
			});
			await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
			// The base module owns the whole tree, so the lifted write goes through; the guest owns none of it.
			expect(withSuppressedSlothletErrorOutputSync(() => api.guest.attack.writeMember("hostGranted", 2))).toBe("LOOSE_SET_NOT_OWNED");
			expect(await api.attack.writeMember("hostGranted", 1)).toBe("done");
			expect(api.slothlet.hostGranted).toBe(1);
			// Only the member the rule names is lifted.
			expect(withSuppressedSlothletErrorOutputSync(() => api.attack.writeMember("lockCaller", 1))).toBe(REFUSED);
		});

		it("hands a module a member the host fixed on the namespace as the namespace holds it, as the engine requires", async () => {
			await load();
			const fixed = { level: 1 };
			Object.defineProperty(api.slothlet.permissions, "hostFixed", {
				value: fixed,
				configurable: false,
				writable: false,
				enumerable: true
			});
			for (const [label, attack] of modules()) {
				expect({ label, same: await attack.readHostFixed() }).toEqual({ label, same: true });
			}
		});

		it("leaves the host's own changes to api.slothlet as they were", async () => {
			await load();
			api.slothlet.hostProbe = 1;
			expect(api.slothlet.hostProbe).toBe(1);
			expect(delete api.slothlet.hostProbe).toBe(true);
			expect(api.slothlet.hostProbe).toBeUndefined();
		});
	});
});
