/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-toggle-ownership.test.vitest.mjs
 *	@Date: 2026-10-26T06:10:18-07:00 (1793020218)
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
 * @fileoverview The permission system's three modes, and what a module does while it is off (#625).
 *
 * `mode: "on"` applies every rule. `mode: "off"` (no `permissions` config, `enabled: false`, or `control.disable()`)
 * refuses no write on ownership or by a `:write` rule, but the built-in write rules still keep module code off the
 * framework's own namespace, root functions, and keys on api nodes, wherever the module reached them. `mode:
 * "disabled"` checks nothing; `slothlet`, `shutdown` and `destroy` stay reserved names on `self` even then.
 *
 * Ownership is recorded in every mode: a member a module places through the api a framework payload hands it is that
 * module's, so once the host enables the system it is held to the module's ownership, not run with the host's. A view
 * a module read while the system was off is the view it reads after, and holds a change made with no standing once the
 * system is on.
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
		["no permissions config", {}, "off"],
		["mode: off", { permissions: { mode: "off" } }, "off"],
		["enabled: false", { permissions: { enabled: false } }, "off"],
		["the system on", { permissions: { defaultPolicy: "allow" } }, "on"],
		["mode: disabled", { permissions: { mode: "disabled" } }, "disabled"]
	])("with %s", (_label, options, systemMode) => {
		// What the built-in write rules decide: the framework's own namespace is kept from module code unless disabled.
		const framework = systemMode === "disabled" ? "done" : "PERMISSION_DENIED";

		it("reports its mode", async () => {
			await load(options);
			expect(api.slothlet.permissions.control.mode).toBe(systemMode);
		});

		it("keeps a module off the permission system's namespace unless the system is disabled", async () => {
			await load(options);
			globalThis[Symbol.for(PROBE)] = (self) => ({
				addRule: outcome(() => {
					self.slothlet.permissions.addRule = () => "swallowed";
				}),
				control: outcome(() => {
					self.slothlet.permissions.control = { enable() {}, disable() {} };
				}),
				defined: outcome(() => Object.defineProperty(self.slothlet.permissions, "removeRule", { value: () => "gone", configurable: true })),
				removed: outcome(() => {
					if (!delete self.slothlet.permissions.removeRule) throw new Error("NOT_DELETED");
				}),
				namespace: outcome(() => {
					self.slothlet.permissions = {};
				})
			});
			const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, framework])));
			if (framework !== "done") {
				expect(typeof api.slothlet.permissions.addRule({ caller: "guest.**", target: "victim.**", effect: "deny" })).toBe("string");
			}
		});

		it("keeps a module off the rest of the framework namespace unless the system is disabled", async () => {
			await load(options);
			globalThis[Symbol.for(PROBE)] = (self) => ({
				member: outcome(() => {
					self.slothlet.metadata.planted = 1;
				}),
				placed: outcome(() => {
					self.slothlet.leak = function leak() {
						return this;
					};
				}),
				prototype: outcome(() => Object.setPrototypeOf(self.slothlet.context, {})),
				closed: outcome(() => Object.preventExtensions(self.slothlet.metadata))
			});
			const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, framework])));
			expect(api.slothlet.metadata.planted).toBe(framework === "done" ? 1 : undefined);
		});

		it("keeps the namespace a module stored on its own node from another module, as reached directly", async () => {
			await load(options);
			globalThis[Symbol.for(PROBE)] = (self) =>
				outcome(() => {
					self.guest.x.ns = self.slothlet;
				});
			expect(await api.guest.x.runWithSelf(PROBE)).toBe("done");
			globalThis[Symbol.for(PROBE)] = (self) => {
				// Read from the other module's node: allowed only where that module's node may be read and written.
				const ns = self.guest.x.ns;
				return {
					addRule: outcome(() => {
						ns.permissions.addRule = () => "swallowed";
					}),
					member: outcome(() => {
						ns.metadata.stored = 1;
					})
				};
			};
			const report = await withSuppressedSlothletErrorOutput(() => api.other.x.runWithSelf(PROBE));
			expect(report).toEqual({ addRule: framework, member: framework });
			if (framework !== "done") {
				expect(typeof api.slothlet.permissions.addRule({ caller: "a.**", target: "b.**", effect: "deny" })).toBe("string");
			}
		});

		it("lands a module's write into another module's subtree unless the system is on", async () => {
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
			const on = systemMode === "on";
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, on ? "LOOSE_SET_NOT_OWNED" : "done"])));
			const v = api.victim.v;
			expect([v.landed, v.defined, v.shelf[0].landed, v.sealedBox.inner.landed, v.deepShelf[0].inner.landed]).toEqual(
				on ? [undefined, undefined, undefined, undefined, undefined] : [1, 2, 3, 4, 5]
			);
		});

		it("refuses defining, deleting, or assigning the framework's reserved names through self", async () => {
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
			// The built-in write rules refuse a module first; disabled, the reserved name still does.
			const code = framework === "done" ? "INVALID_CONFIG_API_PATH_INVALID" : "PERMISSION_DENIED";
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, code])));
			expect(typeof api.shutdown).toBe("function");
			expect(typeof api.destroy).toBe("function");
			expect(typeof api.slothlet.permissions.addRule).toBe("function");
		});

		it.runIf(framework !== "done")("keeps the framework namespace inside an isolated scope a module opens", async () => {
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
							member: outcome(() => {
								self.slothlet.metadata.inScope = 1;
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
			expect(report).toEqual(Object.fromEntries(Object.keys(report).map((key) => [key, "PERMISSION_DENIED"])));
			expect(viewed).toBe(true);
			// Kept from the scope and called later, outside any call, it still runs as the module: no host rule goes.
			expect(withSuppressedSlothletErrorOutputSync(() => outcome(() => removeRule(hostRule)))).toBe("INVALID_PERMISSION_RULE");
			expect(api.slothlet.permissions.removeRule(hostRule)).toBe(true);
		});

		it.runIf(systemMode !== "on")("keeps a module's writes inside an isolated scope in the scope, through a descriptor too", async () => {
			await load(options);
			globalThis[Symbol.for(PROBE)] = (self) =>
				self.slothlet.scope({
					context: {},
					isolation: "full",
					fn: () => ({
						read: outcome(() => {
							self.victim.v.inScope = 1;
						}),
						descriptor: outcome(() => {
							Object.getOwnPropertyDescriptor(self, "victim").value.v.viaDescriptor = 1;
						}),
						seen: [self.victim.v.inScope, self.victim.v.viaDescriptor],
						close: outcome(() => Object.preventExtensions(self.guest)),
						afterClose: typeof self.slothlet.permissions
					})
				});
			const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
			expect(report.read).toBe("done");
			expect(report.descriptor).toBe("done");
			expect(report.seen).toEqual([1, 1]);
			// The scope's views stay open: one closed could no longer answer for what it lists.
			expect(report.close).toMatch(/^TypeError/);
			expect(report.afterClose).toBe("object");
			expect([api.victim.v.inScope, api.victim.v.viaDescriptor]).toEqual([undefined, undefined]);
		});
	});

	it("refuses an unknown mode in the config", async () => {
		await expect(
			slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions: { mode: "partial" } })
		).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});
	});

	it("turns a disabled system on and off from the host, the namespace kept from module code once it is", async () => {
		await load({ permissions: { mode: "disabled" } });
		api.slothlet.permissions.control.enable();
		expect(api.slothlet.permissions.control.mode).toBe("on");
		api.slothlet.permissions.control.disable();
		expect(api.slothlet.permissions.control.mode).toBe("off");
		globalThis[Symbol.for(PROBE)] = (self) =>
			outcome(() => {
				self.slothlet.metadata.planted = 1;
			});
		expect(await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE))).toBe("PERMISSION_DENIED");
	});
});
