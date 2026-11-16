/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/clock-option.test.vitest.mjs
 *	@Date: 2026-11-14T10:40:00-08:00 (1794681600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T10:40:00-08:00 (1794681600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host-only `clock` config option: an instance reads the time and starts its deferred work through the
 * functions the host gave it, and through the ones slothlet loaded with when the host gave none.
 *
 * Fixture: `api_tests/api_test_permissions` for the permission cases, `api_tests/api_test` for the rest.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { normalizeClockConfig } from "@cldmv/slothlet/helpers/config";
import { OwnershipManager } from "#handlers/ownership";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const PERMISSIONS = TEST_DIRS.API_TEST_PERMISSIONS;
const PLAIN = TEST_DIRS.API_TEST;
const REQUIRES_ROLES = {
	caller: "client.**",
	target: "project.files.list",
	effect: "allow",
	requires: ["roles"]
};

/**
 * Let a lifecycle emit's listener notification settle before asserting on what it collected.
 * @returns {Promise<void>}
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe.each(getMatrixConfigs())("Config > clock > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		vi.useRealTimers();
		if (api) await api.shutdown();
		api = null;
	});

	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		/**
		 * Compose the permissions fixture with a fake clock.
		 * @param {{ now: () => number }} clock - The clock option.
		 * @param {object} [extra] - Further permission rules.
		 * @returns {Promise<object>} Bound api.
		 */
		const build = (clock, extra = []) =>
			slothlet({
				...config,
				base: PERMISSIONS,
				clock,
				permissions: { defaultPolicy: "deny", attribution, rules: [REQUIRES_ROLES, ...extra] }
			});

		it("a principal with maxAge goes stale when the fake clock passes it, and not before, with no real wait", async () => {
			let time = 1000;
			api = await build({ now: () => time });
			const resolve = vi.fn(async () => ({}));
			api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve, maxAge: 10 });
			const { checkCall } = api.slothlet.permissions.global;
			await api.slothlet.context.run({ user: "u1" }, async () => {
				const ask = () => checkCall("client.app", "project.files.list", []);
				expect(await ask()).toBe(true);
				expect(ask()).toBe(true);
				time = 1010;
				expect(ask(), "age equal to maxAge is still current").toBe(true);
				time = 1011;
				const stale = ask();
				expect(stale, "one millisecond past maxAge is stale").toBeInstanceOf(Promise);
				expect(await stale).toBe(true);
				expect(resolve).toHaveBeenCalledTimes(2);
				expect(ask()).toBe(true);
			});
		});

		it("a clock that goes backwards does not keep a principal alive past its maxAge", async () => {
			let time = 5000;
			api = await build({ now: () => time });
			api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve: async () => ({}), maxAge: 10 });
			const { checkCall } = api.slothlet.permissions.global;
			await api.slothlet.context.run({ user: "u1" }, async () => {
				const ask = () => checkCall("client.app", "project.files.list", []);
				await ask();
				expect(ask()).toBe(true);
				time = 4000;
				expect(ask()).toBeInstanceOf(Promise);
			});
		});

		it("a clock that answers something that is not a finite number leaves the principal stale", async () => {
			let answer = 5000;
			api = await build({ now: () => answer });
			api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve: async () => ({}), maxAge: 10 });
			const { checkCall } = api.slothlet.permissions.global;
			await api.slothlet.context.run({ user: "u1" }, async () => {
				const ask = () => checkCall("client.app", "project.files.list", []);
				await ask();
				for (const bad of [NaN, Infinity, undefined]) {
					answer = bad;
					expect(ask(), `now() answering ${bad}`).toBeInstanceOf(Promise);
				}
			});
		});

		it("a clock function that throws is not swallowed", async () => {
			let broken = false;
			api = await build({
				now: () => {
					if (broken) throw new RangeError("clock failed");
					return 1;
				}
			});
			api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve: async () => ({}), maxAge: 10 });
			const { checkCall } = api.slothlet.permissions.global;
			await api.slothlet.context.run({ user: "u1" }, async () => {
				await checkCall("client.app", "project.files.list", []);
				broken = true;
				expect(() => checkCall("client.app", "project.files.list", [])).toThrow(RangeError);
			});
		});

		it("records the fake time on audit events, rule records and event metadata", async () => {
			const time = 424242;
			api = await build({ now: () => time }, [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }]);
			const denied = [];
			api.slothlet.lifecycle.on("permission:denied", (payload) => denied.push(payload));
			api.slothlet.permissions.global.checkCall("untrusted.x", "admin.y", []);
			await settle();
			expect(denied).toHaveLength(1);
			expect(denied[0].timestamp).toBe(time);
			expect(denied[0].rule.registeredAt).toBe(time);

			const metas = [];
			api.slothlet.event.on("clock.test", (_payload, meta) => metas.push(meta));
			await api.slothlet.event.emit("clock.test", {});
			expect(metas.map((meta) => meta.at)).toEqual([time]);
		});
	});

	it("takes the reload ID from the fake clock, and keeps the clock across the reload", async () => {
		let time = 1700000000000;
		api = await slothlet({ ...config, base: PLAIN, silent: true, clock: { now: () => time } });
		const first = api.slothlet.instanceID;
		expect(first).toMatch(/^slothlet_1700000000000_/);
		time = 1700000000123;
		await api.slothlet.reload();
		expect(api.slothlet.instanceID).toBe(`${first}_reload_1700000000123`);
		// The reload is made from the config the instance kept, which has no clock; the instance still has its own.
		time = 1700000000999;
		await api.slothlet.reload();
		expect(api.slothlet.instanceID.endsWith("_reload_1700000000999")).toBe(true);
	});

	it("takes the time hook failure sources record from the fake clock", async () => {
		api = await slothlet({ ...config, base: PLAIN, silent: true, hook: true, clock: { now: () => 777 } });
		await api.slothlet.api.add("clocked", {
			fail() {
				throw new Error("clocked failure");
			}
		});
		const seen = [];
		api.slothlet.hook.on("clocked.fail:error", ({ source }) => seen.push(source.timestamp));
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(Promise.resolve().then(() => api.clocked.fail())).rejects.toThrow("clocked failure");
		});
		expect(seen).toEqual([777]);
	});

	it("keeps the clock across a restart, and keeps it out of the config the instance hands out", async () => {
		const time = 31337;
		api = await slothlet({ ...config, base: PLAIN, silent: true, diagnostics: true, clock: { now: () => time } });
		expect(api.slothlet.diag.inspect().config.clock).toBeUndefined();
		await api.slothlet.restart();
		expect(api.slothlet.instanceID).toMatch(/^slothlet_31337_/);
		expect(api.slothlet.diag.inspect().config.clock).toBeUndefined();
	});

	it("runs a deferred background step on the host's setTimeout when it supplies one", async () => {
		vi.useFakeTimers();
		const scheduled = [];
		const recording = (fn, ms, ...rest) => {
			scheduled.push(ms);
			return setTimeout(fn, ms, ...rest);
		};
		api = await slothlet({
			...config,
			base: PLAIN,
			silent: true,
			mode: "lazy",
			tracking: { materialization: true },
			clock: { now: Date.now, setTimeout: recording, clearTimeout }
		});
		// Installed before the instance existed: slothlet's own deferred work waits for the fake clock to move.
		expect(scheduled.length).toBeGreaterThan(0);
		expect(scheduled.every((ms) => ms === 0)).toBe(true);
		const pending = vi.getTimerCount();
		expect(pending).toBeGreaterThan(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(vi.getTimerCount()).toBeLessThan(pending);
	});

	it("with no clock, fake timers installed after slothlet loaded do not move it", async () => {
		api = await slothlet({
			...config,
			base: PERMISSIONS,
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }] }
		});
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2001-01-01T00:00:00Z"));
		const denied = [];
		api.slothlet.lifecycle.on("permission:denied", (payload) => denied.push(payload));
		api.slothlet.permissions.global.checkCall("untrusted.x", "admin.y", []);
		await vi.advanceTimersByTimeAsync(1);
		expect(denied).toHaveLength(1);
		expect(denied[0].timestamp).toBeGreaterThan(Date.parse("2020-01-01T00:00:00Z"));
	});

	it("keeps two instances' clocks apart", async () => {
		api = await slothlet({
			...config,
			base: PERMISSIONS,
			silent: true,
			clock: { now: () => 111 },
			permissions: { defaultPolicy: "allow", rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }] }
		});
		const other = await slothlet({
			...config,
			base: PERMISSIONS,
			silent: true,
			clock: { now: () => 222 },
			permissions: { defaultPolicy: "allow", rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }] }
		});
		try {
			const stamps = { one: [], two: [] };
			api.slothlet.lifecycle.on("permission:denied", (payload) => stamps.one.push(payload.timestamp));
			other.slothlet.lifecycle.on("permission:denied", (payload) => stamps.two.push(payload.timestamp));
			api.slothlet.permissions.global.checkCall("untrusted.x", "admin.y", []);
			other.slothlet.permissions.global.checkCall("untrusted.x", "admin.y", []);
			await settle();
			expect(stamps).toEqual({ one: [111], two: [222] });
		} finally {
			await other.shutdown();
		}
	});

	describe("only the host can supply it", () => {
		it("is not on the config views the instance hands out, and nothing a module does reaches it", async () => {
			let time = 9000;
			api = await slothlet({ ...config, base: PLAIN, silent: true, diagnostics: true, clock: { now: () => time } });
			const views = [api.slothlet.diag.inspect().config, api.slothlet.config ?? {}];
			for (const view of views) expect("clock" in view).toBe(false);
			// Writing one onto what a module can reach changes nothing about the instance's clock.
			const reachable = api.slothlet.diag.inspect().config;
			try {
				reachable.clock = { now: () => 1 };
			} catch {
				// a frozen view refuses the write: the same outcome
			}
			const denied = [];
			api.slothlet.lifecycle.on("hook:registered", () => {});
			api.slothlet.event.on("clock.host", (_payload, meta) => denied.push(meta.at));
			await api.slothlet.event.emit("clock.host", {});
			expect(denied).toEqual([time]);
		});

		it("a module's api.add options and context cannot supply one", async () => {
			api = await slothlet({ ...config, base: PLAIN, silent: true });
			const real = Date.now();
			await api.slothlet.api.add("guest", PERMISSIONS, {
				moduleID: "guest",
				clock: { now: () => 1 },
				context: { clock: { now: () => 1 } }
			});
			const metas = [];
			api.slothlet.event.on("clock.guest", (_payload, meta) => metas.push(meta.at));
			await api.slothlet.event.emit("clock.guest", {});
			expect(metas[0]).toBeGreaterThanOrEqual(real);
		});
	});
});

describe("Config > clock > validation", () => {
	it.each([
		["a string", "now"],
		["a number", 5],
		["null", null],
		["an array of one function", [() => 1]],
		["now that is not a function", { now: 5 }],
		["setTimeout that is not a function", { setTimeout: "x" }],
		["clearTimeout that is not a function", { clearTimeout: {} }]
	])("%s is INVALID_CONFIG", async (_label, clock) => {
		await expect(slothlet({ base: PLAIN, silent: true, clock })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		expect(() => normalizeClockConfig(clock)).toThrow(expect.objectContaining({ code: "INVALID_CONFIG" }));
	});

	it("an object with no members is the default clock, and a member left out is the one slothlet loaded with", async () => {
		const empty = normalizeClockConfig({});
		expect(Object.isFrozen(empty)).toBe(true);
		expect(empty.hostTimers).toBe(false);
		expect(Math.abs(empty.now() - Date.now())).toBeLessThan(1000);
		expect(normalizeClockConfig({ setTimeout }).hostTimers).toBe(true);
		const half = normalizeClockConfig({ now: () => 3 });
		expect(half.now()).toBe(3);
		expect(half.hostTimers).toBe(false);
		expect(normalizeClockConfig(undefined).now).toBe(empty.now);
	});

	it("calls the host's functions with no receiver and passes timer arguments through", () => {
		const calls = [];
		const clock = normalizeClockConfig({
			setTimeout: function (...args) {
				calls.push([this, ...args]);
				return 7;
			},
			clearTimeout: function (handle) {
				calls.push([this, "clear", handle]);
			}
		});
		const handle = clock.setTimeout(() => {}, 5, "extra");
		clock.clearTimeout(handle);
		expect(handle).toBe(7);
		expect(calls[0][0]).toBeUndefined();
		expect(calls[0].slice(2)).toEqual([5, "extra"]);
		expect(calls[1]).toEqual([undefined, "clear", 7]);
	});
});

describe("Config > clock > ownership records", () => {
	it("stamps an ownership entry with the instance's clock", () => {
		const ownership = new OwnershipManager({ clock: { now: () => 42 }, SlothletError: Error, config: {} });
		ownership.register({ moduleID: "m", apiPath: "a.b", value: () => 1 });
		expect(ownership.getPathHistory("a.b").map((entry) => entry.timestamp)).toEqual([42]);
	});
});
