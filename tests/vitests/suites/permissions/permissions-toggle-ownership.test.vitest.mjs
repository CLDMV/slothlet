/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-toggle-ownership.test.vitest.mjs
 *	@Date: 2026-10-26T06:10:18-07:00 (1793020218)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T09:18:03-07:00 (1793031483)
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
		for (const name of ["guest", "other"]) await api.slothlet.api.add(name, path.join(FIXTURE, "guest"), { moduleID: name });
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

	it.each([
		["captured references off", false],
		["captured references on", true]
	])("holds a later change through a view a module read while the system was off, once it is on (%s)", async (_label, capture) => {
		await load({ permissions: { references: { capture } } });
		api.slothlet.permissions.control.disable();
		await api.guest.x.keepVictimFrozenMembers();
		api.slothlet.permissions.control.enable();
		const later = await api.guest.x.keepVictimFrozenMembers();
		const report = withSuppressedSlothletErrorOutputSync(() => later());
		expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, "RUNTIME_NO_ACTIVE_CONTEXT_SELF"])));
		expect(api.victim.v.shelf[0].planted).toBeUndefined();
	});

	it.runIf(runtime === "live")(
		"refuses a change through the api a module is handed from code it cannot attribute, with the system off",
		async () => {
			await load({ permissions: { enabled: false } });
			await api.slothlet.api.add("twin", path.join(FIXTURE, "twin"), { moduleID: "twin" });
			/**
			 * A promise and the function that resolves it.
			 * @returns {[Promise<void>, function(): void]} The gate and its release.
			 */
			const gate = () => {
				let release;
				const promise = new Promise((resolve) => (release = resolve));
				return [promise, release];
			};
			const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
			const [plantGate, releasePlant] = gate();
			const [peerGate, releasePeer] = gate();
			// twin.plant resumes in resume.mjs, which twin.peer imports too, while both are suspended.
			const planting = api.twin.plant(plantGate);
			await turn();
			const waiting = api.twin.peer.wait(peerGate);
			await turn();
			releasePlant();
			expect(await withSuppressedSlothletErrorOutput(() => planting)).toBe("LOOSE_SET_UNATTRIBUTED");
			releasePeer();
			expect(await waiting).toBe("waited");
			expect(api.plantedTwin).toBeUndefined();
		}
	);

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
			expect(api.slothlet.metadata.planted).toBe(label === "the system on" ? undefined : 1);
		});

		it.runIf(label !== "the system on")(
			"refuses a change to the permission namespace a module stored under another member, whoever reaches it there",
			async () => {
				await load(options);
				globalThis[Symbol.for(PROBE)] = (self) =>
					outcome(() => {
						self.slothlet.metadata.stored = self.slothlet.permissions;
					});
				expect(await api.guest.x.runWithSelf(PROBE)).toBe("done");
				globalThis[Symbol.for(PROBE)] = (self) => {
					const stored = self.slothlet.metadata.stored;
					return {
						addRule: outcome(() => {
							stored.addRule = () => "swallowed";
						}),
						control: outcome(() => {
							stored.control = { enable() {}, disable() {} };
						}),
						removeRule: outcome(() => {
							if (!delete stored.removeRule) throw new Error("NOT_DELETED");
						}),
						replaced: outcome(() => {
							self.slothlet.metadata.alias = self.slothlet;
							self.slothlet.metadata.alias.permissions = {};
						})
					};
				};
				const report = await withSuppressedSlothletErrorOutput(() => api.other.x.runWithSelf(PROBE));
				expect(report).toEqual({
					addRule: "PERMISSION_DENIED",
					control: "PERMISSION_DENIED",
					removeRule: "PERMISSION_DENIED",
					replaced: "PERMISSION_DENIED"
				});
				expect(typeof api.slothlet.permissions.addRule({ caller: "other.**", target: "victim.**:write", effect: "deny" })).toBe("string");
				api.slothlet.permissions.control.enable();
				// The system turns on, and the host's rule added before it applies.
				expect(api.slothlet.permissions.control.enabled).toBe(true);
				globalThis[Symbol.for(PROBE)] = (self) =>
					outcome(() => {
						self.victim.v.flag = "x";
					});
				expect(await withSuppressedSlothletErrorOutput(() => api.other.x.runWithSelf(PROBE))).toBe("PERMISSION_DENIED");
				expect(api.victim.v.flag).toBeUndefined();
			}
		);

		it.runIf(label !== "the system on")(
			"keeps a module's writes inside an isolated scope in the scope, through a descriptor too",
			async () => {
				await load(options);
				globalThis[Symbol.for(PROBE)] = (self) =>
					self.slothlet.scope({
						context: {},
						isolation: "full",
						fn: () => ({
							read: outcome(() => {
								self.slothlet.metadata.inScope = 1;
								self.victim.v.inScope = 1;
							}),
							descriptor: outcome(() => {
								Object.getOwnPropertyDescriptor(self.slothlet, "metadata").value.viaDescriptor = 1;
								Object.getOwnPropertyDescriptor(self, "victim").value.v.viaDescriptor = 1;
							}),
							seen: [
								self.slothlet.metadata.inScope,
								self.slothlet.metadata.viaDescriptor,
								self.victim.v.inScope,
								self.victim.v.viaDescriptor
							],
							close: outcome(() => Object.preventExtensions(self.slothlet)),
							afterClose: typeof self.slothlet.permissions
						})
					});
				const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
				expect(report.read).toBe("done");
				expect(report.descriptor).toBe("done");
				expect(report.seen).toEqual([1, 1, 1, 1]);
				// The scope's views stay open: one closed could no longer answer for what it lists.
				expect(report.close).toMatch(/^TypeError/);
				expect(report.afterClose).toBe("object");
				const meta = api.slothlet.metadata;
				expect([meta.inScope, meta.viaDescriptor, api.victim.v.inScope, api.victim.v.viaDescriptor]).toEqual([
					undefined,
					undefined,
					undefined,
					undefined
				]);
			}
		);

		it("keeps both limits inside an isolated scope a module opens", async () => {
			await load(options);
			const hostRule = api.slothlet.permissions.addRule({ caller: "guest.**", target: "guest.**:write", effect: "deny" });
			globalThis[Symbol.for(PROBE)] = (self) =>
				self.slothlet.scope({
					context: {},
					isolation: "full",
					fn: () => ({
						report: {
							addRule: outcome(() => {
								self.slothlet.permissions.addRule = () => "swallowed";
							}),
							slothlet: outcome(() => {
								self.slothlet = { fake: 1 };
							}),
							shutdown: outcome(() => {
								self.shutdown = 1;
							})
						},
						viewed: self.slothlet.permissions.removeRule !== api.slothlet.permissions.removeRule,
						removeRule: self.slothlet.permissions.removeRule
					})
				});
			const { report, viewed, removeRule } = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			const on = label === "the system on";
			expect(report).toEqual({
				addRule: "PERMISSION_DENIED",
				slothlet: on ? "PERMISSION_DENIED" : "INVALID_CONFIG_API_PATH_INVALID",
				shutdown: on ? "PERMISSION_DENIED" : "INVALID_CONFIG_API_PATH_INVALID"
			});
			expect(viewed).toBe(true);
			// Kept from the scope and called later, outside any call, it still runs as the module: no host rule goes.
			expect(withSuppressedSlothletErrorOutputSync(() => outcome(() => removeRule(hostRule)))).toBe("INVALID_PERMISSION_RULE");
			expect(api.slothlet.permissions.removeRule(hostRule)).toBe(true);
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
