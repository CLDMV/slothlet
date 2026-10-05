/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/restart.test.vitest.mjs
 *	@Date: 2026-09-28T00:00:00-07:00 (1790578800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:58-07:00 (1791090898)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.restart()` (#504) — a clean-slate rebuild from the original config,
 * swapped in behind the same `api` reference.
 *
 * @description
 * Contrast with reload(): a restart drops every runtime change (runtime-assigned values, `add()` /
 * `remove()` history, runtime hooks, permission rules, event and lifecycle subscriptions) and every
 * module's module-scope state, while the api reference and held child references keep working —
 * re-pointed at the node at the same path in the new instance. Lifecycle order is
 * `restart` → `shutdown` → `init` → `restarted`.
 */

import path from "node:path";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_restart");
const EXTRA = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_restart_extra");

/**
 * Tracker routine config: runs `tracker.shutdown` on every teardown, so a test can see which import
 * generation of the fixture was shut down.
 * @type {object}
 */
const TRACKER_ROUTINES = { autoRoutines: true, routines: [{ name: "^tracker.shutdown", mode: "shutdown" }] };

/**
 * Read the fixture's shared module-state record.
 * @returns {{imports: number, shutdowns: number[]}} The record.
 */
function fixtureState() {
	return globalThis.__slothletRestartFixture;
}

/**
 * Run a call that may throw synchronously (eager) or reject (lazy) as a promise either way.
 * @param {Function} fn - The call.
 * @returns {Promise<unknown>} Its settled result.
 */
function settle(fn) {
	return Promise.resolve().then(fn);
}

describe.each(getMatrixConfigs({}))("api.slothlet.restart() (#504) > $name", ({ config }) => {
	let api;
	let other;

	beforeEach(() => {
		globalThis.__slothletRestartFixture = { imports: 0, shutdowns: [] };
	});

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		if (other?.shutdown) await other.shutdown();
		api = null;
		other = null;
	});

	/**
	 * Boot the fixture api for the current matrix config.
	 * @param {object} [overrides] - Extra config.
	 * @returns {Promise<object>} The api.
	 */
	async function create(overrides = {}) {
		api = await slothlet({ ...config, base: BASE, silent: true, ...overrides });
		return api;
	}

	it("drops a runtime-assigned value that reload() keeps, and re-runs the module's top level (issue example)", async () => {
		await create();
		const firstGeneration = api.conn.generation;

		api.conn.handlers = { onSend: "x" };
		await api.slothlet.api.reload();
		// reload() re-imports conn.mjs but re-applies the runtime assignment on top of the new emitter.
		expect(api.conn.generation).toBeGreaterThan(firstGeneration);
		expect(api.conn.handlers).toEqual({ onSend: "x" });

		const beforeRestart = api.conn.generation;
		await api.slothlet.restart();
		expect(api.conn.handlers).toBeUndefined();
		expect(api.conn.generation).toBeGreaterThan(beforeRestart);
		expect(typeof api.conn.on).toBe("function");
	});

	it("keeps the api reference and returns it", async () => {
		await create();
		const ref = api;
		const returned = await api.slothlet.restart();
		expect(returned).toBe(ref);
		expect(api).toBe(ref);
		expect(await api.secret.open()).toBe("open");
	});

	it("starts module-scope state fresh", async () => {
		await create();
		await api.counter.increment();
		await api.counter.increment();
		expect(await api.counter.current()).toBe(2);
		await api.slothlet.restart();
		expect(await api.counter.current()).toBe(0);
		expect(await api.counter.increment()).toBe(1);
	});

	it("rebuilds under a new instance ID and `self` inside leaves resolves to the new instance", async () => {
		await create();
		const oldID = api.slothlet.instanceID;
		expect(await api.probe.instanceID()).toBe(oldID);
		await api.slothlet.restart();
		const newID = api.slothlet.instanceID;
		expect(newID).not.toBe(oldID);
		expect(await api.probe.instanceID()).toBe(newID);
		expect(await api.probe.connGeneration()).toBe(api.conn.generation);
	});

	it("does not replay runtime add() / remove() history (reload does)", async () => {
		await create();
		await api.slothlet.api.add("plugin", EXTRA, { moduleID: "restart-plugin" });
		await api.slothlet.api.remove("secret");
		expect(await api.plugin.ping()).toBe("plugin");
		expect(api.secret).toBeUndefined();

		await api.slothlet.reload();
		expect(await api.plugin.ping()).toBe("plugin");
		expect(api.secret).toBeUndefined();

		await api.slothlet.restart();
		expect(api.plugin).toBeUndefined();
		expect(await api.secret.blocked()).toBe("blocked");
	});

	it("re-points a held child reference to the new instance's node at the same path", async () => {
		await create();
		const conn = api.conn;
		const increment = api.counter.increment;
		await increment();
		await increment();
		const firstGeneration = conn.generation;

		await api.slothlet.restart();
		expect(conn.generation).toBe(api.conn.generation);
		expect(conn.generation).toBeGreaterThan(firstGeneration);
		// The held leaf now calls the fresh module (count restarts from zero).
		expect(await increment()).toBe(1);
		expect(await api.counter.current()).toBe(1);
		// Writes through the held reference land on the new instance.
		conn.handlers = { live: true };
		expect(api.conn.handlers).toEqual({ live: true });
	});

	it("follows a held reference across two restarts", async () => {
		await create();
		const conn = api.conn;
		const g1 = conn.generation;
		await api.slothlet.restart();
		const g2 = conn.generation;
		await api.slothlet.restart();
		const g3 = conn.generation;
		expect(g2).toBeGreaterThan(g1);
		expect(g3).toBeGreaterThan(g2);
		expect(g3).toBe(api.conn.generation);
		expect(await api.counter.increment()).toBe(1);
	});

	it("throws RESTART_REFERENCE_UNRESOLVED when a held reference's path no longer exists", async () => {
		await create();
		await api.slothlet.api.add("plugin", EXTRA, { moduleID: "restart-plugin" });
		const plugin = api.plugin;
		expect(await plugin.ping()).toBe("plugin");

		await api.slothlet.restart();
		expect(api.plugin).toBeUndefined();
		let caught = null;
		try {
			await plugin.ping();
		} catch (error) {
			caught = error;
		}
		expect(caught?.code).toBe("RESTART_REFERENCE_UNRESOLVED");
		expect(caught?.message).toContain("plugin");
	});

	it("drops runtime permission rules while config-declared rules apply", async () => {
		await create({
			permissions: { defaultPolicy: "allow", rules: [{ caller: "probe.**", target: "secret.blocked", effect: "deny" }] }
		});
		api.slothlet.permissions.addRule({ caller: "probe.**", target: "secret.open", effect: "deny" });
		await expect(settle(() => api.probe.callBlocked())).rejects.toThrow("PERMISSION_DENIED");
		await expect(settle(() => api.probe.callOpen())).rejects.toThrow("PERMISSION_DENIED");

		await api.slothlet.restart();
		await expect(settle(() => api.probe.callBlocked())).rejects.toThrow("PERMISSION_DENIED");
		expect(await api.probe.callOpen()).toBe("open");
	});

	it("drops runtime hooks", async () => {
		await create({ hook: { enabled: true } });
		const fired = [];
		api.slothlet.hook.on("counter.increment:before", () => {
			fired.push("before");
		});
		await api.counter.increment();
		expect(fired).toEqual(["before"]);

		await api.slothlet.restart();
		await api.counter.increment();
		expect(fired).toEqual(["before"]);
	});

	it("drops runtime event subscriptions", async () => {
		await create();
		const received = [];
		api.slothlet.event.on("restart.test", (payload) => received.push(payload));
		await api.slothlet.event.emit("restart.test", 1);
		expect(received).toEqual([1]);

		await api.slothlet.restart();
		await api.slothlet.event.emit("restart.test", 2);
		expect(received).toEqual([1]);
	});

	it("emits restart → shutdown → init → restarted; runtime subscribers only see the old instance's events", async () => {
		const configEvents = [];
		/**
		 * Record a config-declared lifecycle event.
		 * @param {string} name - Event name.
		 * @returns {Function} Handler.
		 */
		const record = (name) => (data) => configEvents.push({ name, data });
		await create({
			lifecycle: { restart: record("restart"), shutdown: record("shutdown"), init: record("init"), restarted: record("restarted") }
		});
		const oldID = api.slothlet.instanceID;
		expect(configEvents.map((e) => e.name)).toEqual(["init"]);
		expect(configEvents[0].data).toMatchObject({ instanceID: oldID, restart: false });

		const runtimeEvents = [];
		for (const name of ["restart", "shutdown", "init", "restarted"]) {
			api.slothlet.lifecycle.on(name, () => runtimeEvents.push(name));
		}

		configEvents.length = 0;
		await api.slothlet.restart();
		const newID = api.slothlet.instanceID;
		expect(configEvents.map((e) => e.name)).toEqual(["restart", "shutdown", "init", "restarted"]);
		expect(configEvents[0].data).toEqual({ instanceID: oldID });
		expect(configEvents[1].data).toEqual({ instanceID: oldID, restart: true });
		expect(configEvents[2].data).toEqual({ instanceID: newID, restart: true });
		expect(configEvents[3].data).toEqual({ instanceID: newID, previousInstanceID: oldID });
		expect(runtimeEvents).toEqual(["restart", "shutdown"]);

		// The runtime subscriber went with the old instance.
		await api.slothlet.shutdown();
		expect(runtimeEvents).toEqual(["restart", "shutdown"]);
		expect(configEvents.at(-1)).toEqual({ name: "shutdown", data: { instanceID: newID, restart: false } });
		api = null;
	});

	it("shuts the old instance down through the normal teardown path", async () => {
		await create(TRACKER_ROUTINES);
		const oldID = api.slothlet.instanceID;
		expect(fixtureState().shutdowns).toEqual([]);

		await api.slothlet.restart();
		const newID = api.slothlet.instanceID;
		// The old generation's shutdown routine ran exactly once.
		expect(fixtureState().shutdowns).toEqual([1]);
		// The old context store is gone; only the new instance's remains for this api.
		const ids = api.slothlet.diag.inspect().context.instances.map((entry) => entry.id);
		expect(ids).toContain(newID);
		expect(ids.some((id) => id === oldID || id.startsWith(`${oldID}__run_`))).toBe(false);

		await api.shutdown();
		expect(fixtureState().shutdowns).toEqual([1, 2]);
		api = null;
	});

	it("leaves other instances untouched", async () => {
		await create();
		other = await slothlet({ ...config, base: BASE, silent: true });
		await other.counter.increment();
		const otherConn = other.conn;
		const otherGeneration = other.conn.generation;
		const otherID = other.slothlet.instanceID;

		await api.slothlet.restart();
		expect(other.slothlet.instanceID).toBe(otherID);
		expect(await other.probe.instanceID()).toBe(otherID);
		expect(await other.counter.current()).toBe(1);
		expect(other.conn).toBe(otherConn);
		expect(other.conn.generation).toBe(otherGeneration);
		expect(await api.probe.instanceID()).toBe(api.slothlet.instanceID);
	});

	it("lets calls already in flight finish on the old implementation", async () => {
		await create();
		const startGeneration = api.conn.generation;
		const pending = api.probe.slow(150);
		await api.slothlet.restart();
		expect(await pending).toBe(startGeneration);
		expect(api.conn.generation).toBeGreaterThan(startGeneration);
	});

	it("coalesces concurrent restart() calls into one restart", async () => {
		const inits = [];
		await create({ lifecycle: { init: (data) => inits.push(data.instanceID) } });
		const [a, b] = await Promise.all([api.slothlet.restart(), api.slothlet.restart()]);
		expect(a).toBe(api);
		expect(b).toBe(api);
		expect(inits).toHaveLength(2);
		expect(inits[1]).toBe(api.slothlet.instanceID);
	});

	it("rebuilds from the config as passed at creation, not from later mutations of that object", async () => {
		const options = {
			...config,
			base: BASE,
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "probe.**", target: "secret.blocked", effect: "deny" }] }
		};
		api = await slothlet(options);
		options.base = EXTRA;
		options.permissions.rules.length = 0;
		options.permissions.rules.push({ caller: "probe.**", target: "secret.open", effect: "deny" });

		await api.slothlet.restart();
		expect(api.plugin).toBeUndefined();
		await expect(settle(() => api.probe.callBlocked())).rejects.toThrow("PERMISSION_DENIED");
		expect(await api.probe.callOpen()).toBe("open");
	});

	it("is refused when reload mutations are disabled", async () => {
		await create({ api: { mutations: { add: true, remove: true, reload: false } } });
		let caught = null;
		try {
			await api.slothlet.restart();
		} catch (error) {
			caught = error;
		}
		expect(caught?.code).toBe("INVALID_CONFIG_MUTATIONS_DISABLED");
	});

	it("restarts a sealed instance into an unsealed one with only the original config's rules", async () => {
		await create({
			permissions: { defaultPolicy: "allow", rules: [{ caller: "probe.**", target: "secret.blocked", effect: "deny" }] }
		});
		api.slothlet.permissions.addRule({ caller: "probe.**", target: "secret.open", effect: "deny" });
		api.slothlet.permissions.control.seal();
		expect(api.slothlet.permissions.control.sealed).toBe(true);

		await api.slothlet.restart();
		expect(api.slothlet.permissions.control.sealed).toBe(false);
		await expect(settle(() => api.probe.callBlocked())).rejects.toThrow("PERMISSION_DENIED");
		expect(await api.probe.callOpen()).toBe("open");
		// Unsealed: the policy can be changed (and sealed) again.
		expect(() => api.slothlet.permissions.addRule({ caller: "probe.**", target: "secret.open", effect: "deny" })).not.toThrow();
		api.slothlet.permissions.control.seal();
		expect(api.slothlet.permissions.control.sealed).toBe(true);
	});

	it("leaves restart() reachable from a module when there is no permissions config (built-ins inert)", async () => {
		await create();
		const before = api.slothlet.instanceID;
		await api.probe.restartInstance();
		expect(api.slothlet.instanceID).not.toBe(before);
		expect(await api.probe.instanceID()).toBe(api.slothlet.instanceID);
	});

	it("is host-only by default: a module calling restart() is denied (defaultPolicy allow)", async () => {
		await create({ permissions: { defaultPolicy: "allow" } });
		const before = api.slothlet.instanceID;
		await expect(settle(() => api.probe.restartInstance())).rejects.toThrow("PERMISSION_DENIED");
		expect(api.slothlet.instanceID).toBe(before);
	});

	it("runs the user's root shutdown during the teardown, also when a permitted module triggered the restart", async () => {
		await create({ permissions: { defaultPolicy: "allow", rules: [{ caller: "probe.**", target: "slothlet.restart", effect: "allow" }] } });
		const first = api.slothlet.instanceID;
		await api.slothlet.restart();
		expect(fixtureState().userShutdowns).toHaveLength(1);

		const second = api.slothlet.instanceID;
		expect(second).not.toBe(first);
		await api.probe.restartInstance();
		// The module-triggered teardown ran the user's shutdown too — it was not refused halfway.
		expect(fixtureState().userShutdowns).toHaveLength(2);
		expect(api.slothlet.instanceID).not.toBe(second);
		expect(await api.counter.increment()).toBe(1);
	});

	it("lets the host restart, and a host allow rule lets a trusted module restart", async () => {
		await create({ permissions: { defaultPolicy: "allow", rules: [{ caller: "probe.**", target: "slothlet.restart", effect: "allow" }] } });
		const first = api.slothlet.instanceID;
		await api.slothlet.restart();
		const second = api.slothlet.instanceID;
		expect(second).not.toBe(first);

		await api.probe.restartInstance();
		expect(api.slothlet.instanceID).not.toBe(second);
		expect(await api.probe.instanceID()).toBe(api.slothlet.instanceID);
	});
});

describe.each(getMatrixConfigs({}))("api.slothlet.restart() (#504) > held references and teardown edges > $name", ({ config }) => {
	let api;

	beforeEach(() => {
		globalThis.__slothletRestartFixture = { imports: 0, shutdowns: [] };
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
		api = await slothlet({ ...config, base: BASE, silent: true, ...overrides });
		return api;
	}

	it("forwards reflection on a held reference to the new instance's node", async () => {
		await create();
		const conn = api.conn;
		await api.slothlet.restart();

		conn.handlers = { a: 1 };
		expect("handlers" in conn).toBe(true);
		expect(Object.keys(conn)).toEqual(Object.keys(api.conn));
		expect(Object.getOwnPropertyDescriptor(conn, "handlers")?.value).toEqual({ a: 1 });
		expect(Object.getOwnPropertyDescriptor(conn, "no-such-key")).toBeUndefined();
		expect(Object.getPrototypeOf(conn)).toBe(Object.getPrototypeOf(api.conn));
		expect(delete conn.handlers).toBe(true);
		expect(api.conn.handlers).toBeUndefined();
	});

	it("keeps a held function reference within its proxy invariants", async () => {
		await create();
		const increment = api.counter.increment;
		const counter = api.counter;
		await api.slothlet.restart();

		// A function-backed proxy target owns a non-configurable `prototype`; its answers stay tied to it.
		expect("prototype" in increment).toBe(true);
		expect(Reflect.deleteProperty(increment, "prototype")).toBe(false);
		expect(Reflect.ownKeys(increment)).toContain("prototype");
		// A stale `this` is mapped to its live counterpart.
		expect(await increment.call(counter)).toBe(1);

		// Once the target is non-extensible, reflection answers from the target itself.
		Object.preventExtensions(counter);
		expect(() => Reflect.ownKeys(counter)).not.toThrow();
		expect(() => Object.getPrototypeOf(counter)).not.toThrow();
		expect(() => Object.getOwnPropertyDescriptor(counter, "current")).not.toThrow();
	});

	it("constructs through a held class reference against the new instance", async () => {
		await create();
		// Lazy: a namespace read before materialization is a waiting proxy, which is not constructible —
		// the same as a fresh read, so materialize the namespace first (before and after the restart).
		if (config.mode === "lazy") await api.factory.Widget;
		const Widget = api.factory.Widget;
		expect(new Widget().generation).toBe(api.conn.generation);
		await api.slothlet.restart();
		if (config.mode === "lazy") await api.factory.Widget;
		const instance = new Widget();
		expect(instance.generation).toBe(api.conn.generation);
	});

	it("restarts an instance that was already shut down", async () => {
		await create();
		const oldID = api.slothlet.instanceID;
		await api.slothlet.shutdown();
		await api.slothlet.restart();
		expect(api.slothlet.instanceID).not.toBe(oldID);
		expect(await api.counter.increment()).toBe(1);
	});

	it("still rebuilds when a shutdown routine throws, then re-throws its error", async () => {
		await create(TRACKER_ROUTINES);
		const oldID = api.slothlet.instanceID;
		fixtureState().throwOnShutdown = true;
		let caught = null;
		try {
			await api.slothlet.restart();
		} catch (error) {
			caught = error;
		}
		fixtureState().throwOnShutdown = false;
		expect(caught?.code).toBe("ROUTINE_FAILED");
		expect(api.slothlet.instanceID).not.toBe(oldID);
		expect(await api.counter.increment()).toBe(1);
	});

	it("finishes the internal teardown when the root shutdown hook throws", async () => {
		await create();
		const instance = resolveWrapper(api.counter).slothlet;
		const oldID = api.slothlet.instanceID;
		instance.userHooks.shutdown = () => {
			throw new Error("hook failure");
		};
		await expect(api.slothlet.restart()).rejects.toThrow("hook failure");
		const ids = api.slothlet.diag.inspect().context.instances.map((entry) => entry.id);
		expect(ids).not.toContain(oldID);
		expect(await api.counter.increment()).toBe(1);
	});

	it("refuses restart() on an instance with no retained original config", async () => {
		await create();
		resolveWrapper(api.counter).slothlet._originalConfig = null;
		let caught = null;
		try {
			await api.slothlet.restart();
		} catch (error) {
			caught = error;
		}
		expect(caught?.code).toBe("INVALID_CONFIG_NOT_LOADED");
	});

	it("retains an immutable snapshot of the original config", async () => {
		const context = { user: "u" };
		const map = new Map([["k", 1]]);
		const extra = { list: [1, { deep: true }], map, bare: Object.create(null) };
		extra.self = extra;
		Object.defineProperty(extra, "hidden", { value: 1, enumerable: false });
		extra.bare.flag = true;
		await create({ context, extra });
		const snapshot = resolveWrapper(api.counter).slothlet._originalConfig;

		expect(Object.isFrozen(snapshot)).toBe(true);
		expect(snapshot.context).toBe(context);
		expect(snapshot.extra).not.toBe(extra);
		expect(Object.isFrozen(snapshot.extra)).toBe(true);
		expect(Object.isFrozen(snapshot.extra.list[1])).toBe(true);
		expect(snapshot.extra.self).toBe(snapshot.extra);
		expect(snapshot.extra.map).toBe(map);
		expect(Object.getPrototypeOf(snapshot.extra.bare)).toBe(null);
		expect(snapshot.extra.bare.flag).toBe(true);
		expect("hidden" in snapshot.extra).toBe(false);

		await api.slothlet.restart();
		expect(resolveWrapper(api.counter).slothlet.context).toBe(context);
	});

	if (config.mode === "lazy") {
		it("forwards a held lazy waiting reference to the new instance", async () => {
			await create();
			// Taken before `counter` materializes: a waiting proxy for `counter.increment`.
			const increment = api.counter.increment;
			await api.slothlet.restart();
			expect(await increment()).toBe(1);
			expect(typeof increment.name).toBe("string");
		});
	}
});
