/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-toggle-ownership.test.vitest.mjs
 *	@Date: 2026-10-26T06:10:18-07:00 (1793020218)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T07:39:50-07:00 (1793025590)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a module does while the permission system is off holds once the host enables it (#625).
 *
 * With the system off nothing refuses a module's write, but ownership is still recorded as with it on: a member a
 * module places through the api a framework payload hands it is that module's, so once the host enables the system
 * the member is held to the module's ownership, not run with the host's. A view a module read while the system was
 * off is the view it reads after, and holds a change it makes with no standing once the system is on.
 *
 * Two limits stay on whether or not the system is: a module never changes the permission system's own namespace
 * (it would drop the rules the host registers before enabling it), and the framework's namespace and root functions
 * are reserved names, refused when defined or deleted through `self` as when assigned.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const PROBE = "slothlet.test.i625.toggle";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * Run `change`, reporting `"done"` or the error code it was refused with.
 * @param {function(): *} change - The change.
 * @returns {string} The outcome.
 */
const outcome = (change) => {
	try {
		change();
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
};

describe.each(CONFIGS)("ownership across a permission toggle (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		delete globalThis[Symbol.for(PROBE)];
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `victim` and `guest`.
	 * @param {object} [options] - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options = {}) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, diagnostics: true, ...options });
		await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
		return api;
	}

	it("records a member a module places through the api it is handed as the module's, and holds it once enabled", async () => {
		await load({ permissions: { enabled: false } });
		globalThis[Symbol.for(PROBE)] = (self) => {
			/**
			 * Write into the victim's subtree.
			 * @returns {string} The outcome.
			 */
			const writeVictim = () =>
				outcome(() => {
					self.victim.v.flag = "planted";
				});
			self.slothlet.diag.getAPI().plantedRoot = writeVictim;
			self.plantedTop = writeVictim;
		};
		await api.guest.x.runWithSelf(PROBE);
		api.slothlet.permissions.control.enable();
		const report = await withSuppressedSlothletErrorOutput(async () => ({
			root: await api.plantedRoot(),
			top: await api.plantedTop()
		}));
		expect(report).toEqual({ root: "LOOSE_SET_NOT_OWNED", top: "LOOSE_SET_NOT_OWNED" });
		expect(api.victim.v.flag).toBeUndefined();
	});

	it("holds a later change through a view a module read while the system was off, once it is on", async () => {
		await load({ permissions: { references: { capture: false } } });
		api.slothlet.permissions.control.disable();
		await api.guest.x.keepVictimFrozenMembers();
		api.slothlet.permissions.control.enable();
		const later = await api.guest.x.keepVictimFrozenMembers();
		const report = withSuppressedSlothletErrorOutputSync(() => later());
		expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, "RUNTIME_NO_ACTIVE_CONTEXT_SELF"])));
		expect(api.victim.v.shelf[0].planted).toBeUndefined();
	});

	describe.each([
		["no permissions config", {}],
		["enabled: false", { permissions: { enabled: false } }],
		["the system on", { permissions: { defaultPolicy: "allow" } }]
	])("with %s", (label, options) => {
		it("refuses a module changing the permission system's namespace, and keeps the host's rules", async () => {
			await load(options);
			globalThis[Symbol.for(PROBE)] = (self) => ({
				addRule: outcome(() => {
					self.slothlet.permissions.addRule = () => "swallowed";
				}),
				namespace: outcome(() => {
					self.slothlet.permissions = {};
				}),
				defined: outcome(() => Object.defineProperty(self.slothlet.permissions, "addRule", { value: () => "swallowed" })),
				removed: outcome(() => {
					if (!delete self.slothlet.permissions.addRule) throw new Error("NOT_DELETED");
				})
			});
			const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			expect(report).toEqual({
				addRule: "PERMISSION_DENIED",
				namespace: "PERMISSION_DENIED",
				defined: "PERMISSION_DENIED",
				removed: "PERMISSION_DENIED"
			});
			expect(typeof api.slothlet.permissions.addRule({ caller: "guest.**", target: "victim.**", effect: "deny" })).toBe("string");
		});

		it("lands a module's write into another module's subtree only with the system off", async () => {
			await load(options);
			globalThis[Symbol.for(PROBE)] = (self) => {
				const v = self.victim.v;
				return {
					assign: outcome(() => {
						v.landed = 1;
					}),
					define: outcome(() => Object.defineProperty(v, "defined", { value: 2, configurable: true, writable: true, enumerable: true })),
					frozenElement: outcome(() => {
						v.shelf[0].landed = 3;
					}),
					frozenInner: outcome(() => {
						v.sealedBox.inner.landed = 4;
					}),
					frozenDeep: outcome(() => {
						v.deepShelf[0].inner.landed = 5;
					})
				};
			};
			const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			const off = label !== "the system on";
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, off ? "done" : "LOOSE_SET_NOT_OWNED"])));
			const v = api.victim.v;
			expect([v.landed, v.defined, v.shelf[0].landed, v.sealedBox.inner.landed, v.deepShelf[0].inner.landed]).toEqual(
				off ? [1, 2, 3, 4, 5] : [undefined, undefined, undefined, undefined, undefined]
			);
		});

		it("lets a module change the rest of the framework namespace only with the system off", async () => {
			await load(options);
			globalThis[Symbol.for(PROBE)] = (self) =>
				outcome(() => {
					self.slothlet.metadata.planted = 1;
				});
			const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			expect(report).toBe(label === "the system on" ? "PERMISSION_DENIED" : "done");
		});

		it("refuses defining or deleting the framework's reserved names through self, as assigning them", async () => {
			await load(options);
			globalThis[Symbol.for(PROBE)] = (self) => {
				const root = self.slothlet.diag.getAPI();
				const report = {};
				for (const name of ["slothlet", "shutdown", "destroy"]) {
					report[`${name}Assign`] = outcome(() => {
						self[name] = () => "planted";
					});
					report[`${name}Define`] = outcome(() => Object.defineProperty(self, name, { value: () => "planted", configurable: true }));
					report[`${name}Delete`] = outcome(() => {
						delete self[name];
					});
					report[`${name}RootDefine`] = outcome(() => Object.defineProperty(root, name, { value: () => "planted", configurable: true }));
					report[`${name}RootDelete`] = outcome(() => {
						delete root[name];
					});
				}
				return report;
			};
			const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			// With the system on, the built-in write rules refuse a module first; with it off, the reserved name does.
			const code = label === "the system on" ? "PERMISSION_DENIED" : "INVALID_CONFIG_API_PATH_INVALID";
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, code])));
			expect(typeof api.shutdown).toBe("function");
			expect(typeof api.destroy).toBe("function");
			expect(typeof api.slothlet.permissions.addRule).toBe("function");
		});
	});
});
