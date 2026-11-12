/**
 * @fileoverview The event pool follows the permission mode. Event levels are part of the permission system
 * (`permissions.events`, #407): while it is not on, no event rule is evaluated and every subscription is delivered at
 * `allow`, payload included, as call and read rules are not evaluated there either.
 *
 * @description
 * Expected values come from the rule:
 *
 * | Mode                                             | Level of a module's subscription                    |
 * | ------------------------------------------------ | --------------------------------------------------- |
 * | no `permissions` block, `mode: "off"`, `enabled: false` | `allow`, whatever `events.default` and the rules say |
 * | `mode: "disabled"`                               | `allow`, whatever `events.default` and the rules say |
 * | `mode: "on"` (or a `permissions` block)          | the event rules: built-in `notify`, then `events.default`, manifest, instance and runtime rules |
 *
 * `on()`'s returned `level`, `event.resolveLevel`, the `levels` map a strategy is handed at emit time and the level a
 * delivery is made at all have to agree.
 * @module tests/vitests/suites/events/event-permission-mode
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_EVENTS;
const FIX_EVT_MODULE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_events_module");

/** Event rules that would refuse or strip everything if they were evaluated. */
const STRICT_EVENTS = {
	default: "deny",
	rules: [
		{ caller: "**", event: "**", effect: "deny" },
		{ caller: "subscriber.**", event: "news.*", effect: "notify" }
	]
};

/**
 * Ways the permission system is not on.
 * @type {Array<{label: string, permissions: object|undefined}>}
 */
const NOT_ON = [
	{ label: "no permissions block", permissions: undefined },
	{ label: 'mode "off" with no event rules', permissions: { mode: "off", defaultPolicy: "allow" } },
	{ label: 'mode "off" with deny event rules', permissions: { mode: "off", defaultPolicy: "allow", events: STRICT_EVENTS } },
	{ label: "enabled: false with deny event rules", permissions: { enabled: false, defaultPolicy: "allow", events: STRICT_EVENTS } },
	{ label: 'mode "disabled" with no event rules', permissions: { mode: "disabled", defaultPolicy: "allow" } },
	{ label: 'mode "disabled" with deny event rules', permissions: { mode: "disabled", defaultPolicy: "allow", events: STRICT_EVENTS } }
];

/**
 * Subscribe the fixture's module, emit once through a strategy that records the envelope, and report every place a
 * level shows.
 * @param {object} api - The instance.
 * @param {string} event - The event name.
 * @param {*} payload - What to emit.
 * @returns {Promise<{on: string, resolved: string, emitLevels: string[], delivered: Array<object>, got: Array<object>}>}
 *   The level `on()` returned, the level `resolveLevel` answers, the levels in the strategy's envelope, what each
 *   `deliver` resolved to, and what the module's listener received.
 */
async function levelsEverywhere(api, event, payload) {
	const on = await api.subscriber.subscribe(event);
	const resolved = api.slothlet.event.resolveLevel("subscriber.subscribe", event);
	const held = [];
	api.slothlet.event.strategy((envelope, listeners) => {
		held.push({ envelope, listeners });
	});
	await api.emitter.fire(event, payload);
	api.slothlet.event.strategy(null);
	const emitLevels = held.flatMap(({ envelope }) => Object.values(envelope.levels));
	const delivered = [];
	for (const { envelope, listeners } of held) {
		for (const id of listeners) delivered.push(await api.slothlet.event.deliver(envelope, id));
	}
	const got = await api.subscriber.drain();
	return { on, resolved, emitLevels, delivered, got: got.map((entry) => ({ payload: entry.payload, event: entry.meta.event })) };
}

describe.each(getMatrixConfigs())("Events > the event pool follows the permission mode > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	describe.each(NOT_ON)("not on: $label", ({ permissions }) => {
		it("a module's subscription is delivered at allow, payload included, in every place a level shows", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
			expect(await levelsEverywhere(api, "news.item", { secret: "top" })).toEqual({
				on: "allow",
				resolved: "allow",
				emitLevels: ["allow"],
				delivered: [{ delivered: true, level: "allow" }],
				got: [{ payload: { secret: "top" }, event: "news.item" }]
			});
		});

		it("without a strategy the listener gets the payload", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
			expect(await api.subscriber.subscribe("orders.created")).toBe("allow");
			await api.emitter.fire("orders.created", { id: 7 });
			expect((await api.subscriber.drain()).map((entry) => entry.payload)).toEqual([{ id: 7 }]);
		});

		it("a deny rule added at runtime is not evaluated either", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
			api.slothlet.event.rules.add({ caller: "subscriber.**", event: "orders.*", effect: "deny" });
			expect(await api.subscriber.subscribe("orders.created")).toBe("allow");
			expect(api.slothlet.event.resolveLevel("subscriber.subscribe", "orders.created")).toBe("allow");
			await api.emitter.fire("orders.created", { id: 8 });
			expect((await api.subscriber.drain()).map((entry) => entry.payload)).toEqual([{ id: 8 }]);
		});
	});

	describe("on", () => {
		it("with no event rules the built-in base level is notify: the trigger, no payload", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { mode: "on", defaultPolicy: "allow" } });
			expect(await levelsEverywhere(api, "news.item", { secret: "top" })).toEqual({
				on: "notify",
				resolved: "notify",
				emitLevels: ["notify"],
				delivered: [{ delivered: true, level: "notify" }],
				got: [{ payload: undefined, event: "news.item" }]
			});
		});

		it("a permissions block with no mode is on", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, permissions: { defaultPolicy: "allow" } });
			expect(await api.subscriber.subscribe("news.item")).toBe("notify");
		});

		it("events.default and the rules decide: allow, notify and deny", async () => {
			api = await slothlet({
				...config,
				base: BASE,
				silent: true,
				permissions: {
					mode: "on",
					defaultPolicy: "allow",
					events: {
						default: "allow",
						rules: [
							{ caller: "subscriber.**", event: "news.*", effect: "notify" },
							{ caller: "subscriber.**", event: "blocked.*", effect: "deny" }
						]
					}
				}
			});
			expect(await levelsEverywhere(api, "orders.created", { id: 1 })).toEqual({
				on: "allow",
				resolved: "allow",
				emitLevels: ["allow"],
				delivered: [{ delivered: true, level: "allow" }],
				got: [{ payload: { id: 1 }, event: "orders.created" }]
			});
			expect(await levelsEverywhere(api, "news.item", { id: 2 })).toEqual({
				on: "notify",
				resolved: "notify",
				emitLevels: ["notify"],
				delivered: [{ delivered: true, level: "notify" }],
				got: [{ payload: undefined, event: "news.item" }]
			});
			expect(await levelsEverywhere(api, "blocked.thing", { id: 3 })).toEqual({
				on: "deny",
				resolved: "deny",
				emitLevels: [],
				delivered: [],
				got: []
			});
		});

		it("the strict rules that the other modes ignore refuse here", async () => {
			api = await slothlet({
				...config,
				base: BASE,
				silent: true,
				permissions: { mode: "on", defaultPolicy: "allow", events: STRICT_EVENTS }
			});
			expect(await api.subscriber.subscribe("orders.created")).toBe("deny");
			expect(await api.subscriber.subscribe("news.item")).toBe("notify");
		});
	});

	describe("a manifest's event rule", () => {
		it("takes effect under on", async () => {
			api = await slothlet({
				...config,
				base: BASE,
				silent: true,
				permissions: { mode: "on", defaultPolicy: "allow", events: { default: "deny" } }
			});
			await api.slothlet.api.modules.addModule("@local/evt-plugin", { discover: { scanRoot: FIX_EVT_MODULE } });
			// Manifest: { caller: "subscriber.**", event: "manifest.*", effect: "allow" }.
			expect(await api.subscriber.subscribe("manifest.data")).toBe("allow");
			expect(await api.subscriber.subscribe("other.thing")).toBe("deny");
		});

		it.each(["off", "disabled"])("is not evaluated under %s: everything is allow", async (mode) => {
			api = await slothlet({
				...config,
				base: BASE,
				silent: true,
				permissions: { mode, defaultPolicy: "allow", events: { default: "deny" } }
			});
			await api.slothlet.api.modules.addModule("@local/evt-plugin", { discover: { scanRoot: FIX_EVT_MODULE } });
			expect(await api.subscriber.subscribe("manifest.data")).toBe("allow");
			expect(await api.subscriber.subscribe("other.thing")).toBe("allow");
		});
	});

	describe("the mode changed at runtime", () => {
		it("a subscription made while off is held to the rules once the system is switched on, and back", async () => {
			api = await slothlet({
				...config,
				base: BASE,
				silent: true,
				permissions: { mode: "off", defaultPolicy: "allow", events: { default: "notify" } }
			});
			expect(await api.subscriber.subscribe("news.item")).toBe("allow");
			await api.emitter.fire("news.item", { n: 1 });
			expect((await api.subscriber.drain()).map((entry) => entry.payload)).toEqual([{ n: 1 }]);

			api.slothlet.permissions.control.enable();
			expect(api.slothlet.event.resolveLevel("subscriber.subscribe", "news.item")).toBe("notify");
			await api.emitter.fire("news.item", { n: 2 });
			expect((await api.subscriber.drain()).map((entry) => entry.payload)).toEqual([undefined]);

			api.slothlet.permissions.control.disable();
			expect(api.slothlet.event.resolveLevel("subscriber.subscribe", "news.item")).toBe("allow");
			await api.emitter.fire("news.item", { n: 3 });
			expect((await api.subscriber.drain()).map((entry) => entry.payload)).toEqual([{ n: 3 }]);
		});
	});

	it("a host subscription is allow in every mode", async () => {
		for (const permissions of [
			undefined,
			{ mode: "off" },
			{ mode: "disabled" },
			{ mode: "on", defaultPolicy: "allow", events: STRICT_EVENTS }
		]) {
			const instance = await slothlet({ ...config, base: BASE, silent: true, ...(permissions ? { permissions } : {}) });
			try {
				const got = [];
				const { level } = instance.slothlet.event.on("orders.created", (payload) => got.push(payload));
				expect(level).toBe("allow");
				await instance.slothlet.event.emit("orders.created", { id: 9 });
				expect(got).toEqual([{ id: 9 }]);
			} finally {
				await instance.shutdown();
			}
		}
	});
});
