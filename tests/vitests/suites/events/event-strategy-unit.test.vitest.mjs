/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-strategy-unit.test.vitest.mjs
 *	@Date: 2026-09-28T21:34:06-07:00 (1790656446)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:28-07:00 (1791091708)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unit coverage for the #497 delivery-strategy edges of EventManager and the context
 * managers' captured-flow replay that the full-instance suite does not reach: argument guards on
 * `on({ key })` / `strategy` / `deliver`, numeric keys, a strategy seeing an event with no listeners,
 * `defaultDeliver` idempotence, delivery without a flow-capturing context manager, a foreign
 * instance's envelope, and replay against an instance whose context store is gone.
 *
 * @module tests/vitests/suites/events/event-strategy-unit.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { EventManager } from "#handlers/event-manager";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Minimal mock Slothlet instance with no permission manager and a context manager that cannot
 * capture flows (the "no flow" delivery path).
 * @returns {object} Mock slothlet.
 */
function makeSlothlet() {
	return {
		SlothletError,
		SlothletWarning,
		instanceID: "evt-strategy-unit",
		config: { silent: true },
		contextManager: { getCallerIdentity: () => null, tryGetContext: () => null },
		handlers: {}
	};
}

describe("EventManager strategy/deliver — unit edges", () => {
	it("on() rejects a key that is empty, or neither a string nor a finite number, and accepts a numeric key", () => {
		const em = new EventManager(makeSlothlet());
		expect(() => em.on("evt", () => {}, { key: "" })).toThrow(/INVALID_ARGUMENT/);
		expect(() => em.on("evt", () => {}, { key: {} })).toThrow(/INVALID_ARGUMENT/);
		expect(() => em.on("evt", () => {}, { key: Number.NaN })).toThrow(/INVALID_ARGUMENT/);
		expect(em.on("evt", () => {}, { key: 5 }).id).toBe(":evt:5");
		expect(em.once("evt", () => {}).id).toBe(":evt:0");
	});

	it("strategy() rejects a non-function, non-null value", () => {
		const em = new EventManager(makeSlothlet());
		expect(() => em.strategy(42)).toThrow(/INVALID_ARGUMENT/);
		expect(() => em.strategy(undefined)).toThrow(/INVALID_ARGUMENT/);
		em.strategy(null);
		expect(em.exportStrategy()).toBe(null);
	});

	it("a strategy is called even for an event with no listeners, with an empty recipient list", async () => {
		const em = new EventManager(makeSlothlet());
		const calls = [];
		em.strategy((envelope, listeners) => calls.push({ envelope, listeners }));
		await em.emit("nobody.listens", { x: 1 });
		expect(calls).toHaveLength(1);
		expect(calls[0].listeners).toEqual([]);
		expect(calls[0].envelope.emitter).toBe(null);
		expect(Object.isFrozen(calls[0].envelope)).toBe(true);
	});

	it("defaultDeliver is idempotent — calling it twice delivers once", async () => {
		const em = new EventManager(makeSlothlet());
		let count = 0;
		em.on("evt", () => count++);
		em.strategy((envelope, listeners, defaultDeliver) => {
			const first = defaultDeliver();
			expect(defaultDeliver()).toBe(first);
			return first;
		});
		await em.emit("evt");
		expect(count).toBe(1);
	});

	it("deliver works without a flow-capturing context manager, and rejects bad envelopes / ids", async () => {
		const em = new EventManager(makeSlothlet());
		const queue = [];
		em.strategy((envelope) => queue.push(envelope));
		let got = null;
		const { id } = em.on("evt", (payload) => {
			got = payload;
		});
		await em.emit("evt", { n: 3 });
		expect(await em.deliver(queue[0], id)).toEqual({ delivered: true, level: "allow" });
		expect(got).toEqual({ n: 3 });

		await expect(em.deliver(null, id)).rejects.toThrow(/INVALID_ARGUMENT/);
		await expect(em.deliver("envelope", id)).rejects.toThrow(/INVALID_ARGUMENT/);
		await expect(em.deliver(queue[0], 7)).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("an envelope produced by another instance is refused", async () => {
		const a = new EventManager(makeSlothlet());
		const b = new EventManager(makeSlothlet());
		const queue = [];
		a.strategy((envelope) => queue.push(envelope));
		const { id } = a.on("evt", () => {});
		await a.emit("evt");
		await expect(b.deliver(queue[0], id)).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("shutdown clears the strategy", async () => {
		const em = new EventManager(makeSlothlet());
		em.strategy(() => {});
		em.shutdown();
		expect(em.exportStrategy()).toBe(null);
	});
});

describe.each(getMatrixConfigs({ mode: "eager" }))("Events > captured-flow replay after shutdown > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("deliver rejects with CONTEXT_NOT_FOUND once the instance's context store is gone", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_EVENTS });
		const queue = [];
		api.slothlet.event.strategy((envelope) => queue.push(envelope));
		const { id } = api.slothlet.event.on("evt", () => {});
		await api.slothlet.event.emit("evt");
		const deliver = api.slothlet.event.deliver;
		await api.shutdown();
		api = null;
		await expect(deliver(queue[0], id)).rejects.toThrow(/CONTEXT_NOT_FOUND/);
	});
});
