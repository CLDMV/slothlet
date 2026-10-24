/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-removed-callbacks.test.vitest.mjs
 *	@Date: 2026-10-24T00:38:05-07:00 (1792827485)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T08:39:01-07:00 (1792856341)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's callbacks go with it: once it is removed, its hooks, event listeners, and lifecycle
 * subscribers do nothing more, and its code registers none again (#625).
 *
 * A removed module's code has no standing. The framework's own callbacks are no exception: a hook it registered no
 * longer fires, whoever is mounted at its old path or under its old id since, and code it kept cannot reach
 * `self.slothlet.*` to register new ones. A module's lifecycle subscriber is handed the event, never the instance's
 * internal token.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GUEST = path.join(FIXTURE, "guest");
const VICTIM = path.join(FIXTURE, "victim");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const HOOK_GRANT = { caller: "g.**", target: "victim.**:hook", effect: "allow" };

describe.each(CONFIGS)("a removed module's callbacks (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module, `victim`, and the guest code as `g` (moduleID `gA`).
	 * @param {object} options - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, hook: { enabled: true }, ...options });
		await api.slothlet.api.add("victim", VICTIM, { moduleID: "victim" });
		await api.slothlet.api.add("g", GUEST, { moduleID: "gA" });
		api.g.x.takeLifecycleSeen();
		return api;
	}

	it("stops a removed module's hook on another module, which the rules let it hook", async () => {
		await load({ permissions: { rules: [HOOK_GRANT] } });
		expect(api.g.x.registerCallbacks("victim.v.secret:after", "victim.news").hook).toBe("done");
		expect(await api.victim.v.secret()).toBe("HOOKED:SECRET");
		await api.slothlet.api.remove("gA");
		expect(await api.victim.v.secret()).toBe("SECRET");
		await api.slothlet.reload();
		expect(await api.victim.v.secret()).toBe("SECRET");
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("stops a removed module's hook on its old path, whoever is mounted there since (permissions %s)", async (_label, options) => {
		await load(options);
		expect(api.g.x.registerCallbacks("g.v.**:after", "g.news").hook).toBe("done");
		await api.slothlet.api.remove("gA");
		await api.slothlet.api.add("g", VICTIM, { moduleID: "other" });
		expect(await api.g.v.secret()).toBe("SECRET");
		await api.slothlet.api.remove("other");
		await api.slothlet.api.add("g", VICTIM, { moduleID: "gA" });
		expect(await api.g.v.secret()).toBe("SECRET");
	});

	it.each([
		["on", { permissions: { rules: [HOOK_GRANT] } }],
		["off", {}]
	])("refuses a removed module's kept code registering callbacks (permissions %s)", async (_label, options) => {
		await load(options);
		const late = api.g.x.keepRegistering("victim.v.secret:after", "victim.news");
		await api.slothlet.api.remove("gA");
		const outcome = withSuppressedSlothletErrorOutputSync(() => late());
		expect(outcome).toEqual({ hook: "PERMISSION_DENIED", event: "PERMISSION_DENIED", lifecycle: "PERMISSION_DENIED" });
		expect(await api.victim.v.secret()).toBe("SECRET");
	});

	it("leaves a removed module's kept code without standing while another removal is held open", async () => {
		api = await slothlet({
			base: path.join(FIXTURE, "base"),
			mode,
			runtime,
			silent: true,
			hook: { enabled: true },
			permissions: {}
		});
		await api.slothlet.api.add("victim", VICTIM, { moduleID: "victim" });
		await api.slothlet.api.add("g", GUEST, { moduleID: "gA" });
		await api.slothlet.api.add("holder", GUEST, { moduleID: "holder" });
		await api.slothlet.api.add("bait", VICTIM, { moduleID: "bait" });
		const caller = api.g.x.keepCaller("victim.v.secret");
		const registering = api.g.x.keepRegistering("victim.v.secret:after", "victim.news");
		expect(await caller()).toBe("SECRET");
		api.holder.x.holdRemoval("bait");
		const held = api.slothlet.api.remove("bait");
		await api.slothlet.api.remove("gA");
		expect(await withSuppressedSlothletErrorOutput(() => caller())).toBe("PERMISSION_DENIED");
		expect(withSuppressedSlothletErrorOutputSync(() => registering())).toEqual({
			hook: "PERMISSION_DENIED",
			event: "PERMISSION_DENIED",
			lifecycle: "PERMISSION_DENIED"
		});
		globalThis[Symbol.for("slothlet.test.i625.release")]();
		await held;
		expect(await api.victim.v.secret()).toBe("SECRET");
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("tells a module's lifecycle subscriber of the module's own removal (permissions %s)", async (_label, options) => {
		await load(options);
		expect(api.g.x.registerCallbacks("g.v.**:after", "g.news").lifecycle).toBe("done");
		await api.slothlet.api.remove("gA");
		const seen = globalThis[Symbol.for("slothlet.test.i625.lifecycleSeen")].splice(0);
		expect(seen.some((entry) => entry.event === "impl:removed" && String(entry.apiPath).startsWith("g"))).toBe(true);
	});

	it.each([
		["on", { permissions: { rules: [HOOK_GRANT, { caller: "g.**", target: "slothlet.event.strategy", effect: "allow" }] } }],
		["off", {}]
	])("runs a module's event strategy as that module, and drops it with the module (permissions %s)", async (_label, options) => {
		await load(options);
		expect(api.g.x.installStrategy("victim.v")).toBe("done");
		api.g.x.takeConditionWrites();
		api.victim.v.listen("victim.news");
		await api.victim.v.shout("victim.news", { n: 1 });
		const writes = api.g.x.takeConditionWrites();
		expect(writes.length).toBeGreaterThan(0);
		expect([...new Set(writes)]).toEqual(["LOOSE_SET_NOT_OWNED"]);
		expect(api.victim.v.viaStrategy).toBeUndefined();
		await api.slothlet.api.remove("gA");
		api.victim.v.takeHeard();
		await api.victim.v.shout("victim.news", { n: 2 });
		expect(globalThis[Symbol.for("slothlet.test.i625.conditionWrites")].splice(0)).toEqual([]);
		// Delivered as before, the strategy gone: once, at the level the listener's rules give it.
		expect(api.victim.v.takeHeard()).toHaveLength(1);
	});

	it("delivers an event held for a removed module's listener to no other module's listener under its id", async () => {
		await load({});
		const held = [];
		api.slothlet.event.strategy((envelope) => {
			held.push(envelope);
		});
		expect(api.g.x.registerCallbacks("g.v.**:after", "victim.news").event).toBe("done");
		await api.victim.v.shout("victim.news", { n: 1 });
		expect(held).toHaveLength(1);
		const [envelope] = held;
		const [listenerId] = envelope.listeners;
		await api.slothlet.api.remove("gA");
		await api.slothlet.api.add("g2", GUEST, { moduleID: "gA" });
		expect(api.g2.x.registerCallbacks("g2.v.**:after", "victim.news").event).toBe("done");
		globalThis[Symbol.for("slothlet.test.i625.lifecycleSeen")].splice(0);
		expect(await api.slothlet.event.deliver(envelope, listenerId)).toEqual({ delivered: false, reason: "listener-gone" });
		expect(globalThis[Symbol.for("slothlet.test.i625.lifecycleSeen")].splice(0).filter((entry) => entry.tokenType === "event")).toEqual([]);
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("hands a module's lifecycle subscriber no token, and nothing once the module is removed (permissions %s)", async (_label, options) => {
		await load(options);
		expect(api.g.x.registerCallbacks("g.v.**:after", "g.news").lifecycle).toBe("done");
		await api.slothlet.api.add("tmp1", VICTIM, { moduleID: "tmp1" });
		await api.slothlet.api.remove("tmp1");
		const seen = api.g.x.takeLifecycleSeen().filter((entry) => entry.event === "impl:removed");
		expect(seen.length).toBeGreaterThan(0);
		expect(seen.every((entry) => entry.tokenType === "undefined")).toBe(true);
		await api.slothlet.api.remove("gA");
		// What it heard of its own removal is checked above; another module's removal it hears nothing of.
		globalThis[Symbol.for("slothlet.test.i625.lifecycleSeen")].splice(0);
		await api.slothlet.api.remove("victim");
		const globalSeen = globalThis[Symbol.for("slothlet.test.i625.lifecycleSeen")].splice(0);
		expect(globalSeen.filter((entry) => entry.event === "impl:removed")).toEqual([]);
	});
});
