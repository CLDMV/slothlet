/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/events/event-manager-copy-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:21:15-08:00 (1795598475)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:44-08:00 (1795869104)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview EventManager arms the integration suites do not reach: the write paths of a run's copy
 * (`off`, `strategy`, an `off` handed out before the fork), a ceiling call with no api path, a removed
 * module's listener at dispatch, a listener denied at emit time under a strategy, and a strategy a removed
 * module installed.
 *
 * @module tests/vitests/suites/events/event-manager-copy-arms.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { EventManager } from "#handlers/event-manager";
import { FORK, WRITE_TARGET } from "#helpers/flow-stores";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * A minimal slothlet stand-in for the EventManager.
 * @param {object} [opts] - Options.
 * @param {Function} [opts.identity] - What `getCallerIdentity()` returns.
 * @param {object} [opts.pm] - Permission manager.
 * @param {object} [opts.apiManager] - Api manager.
 * @returns {object} Mock slothlet.
 * @example
 * const s = makeSlothlet();
 */
function makeSlothlet({ identity = () => null, pm, apiManager } = {}) {
	const handlers = {};
	if (pm !== undefined) handlers.permissionManager = pm;
	if (apiManager !== undefined) handlers.apiManager = apiManager;
	return {
		SlothletError,
		SlothletWarning,
		instanceID: "evt-copy",
		config: { silent: true },
		contextManager: { getCallerIdentity: identity, runInContext: undefined, tryGetContext: () => null },
		handlers
	};
}

/**
 * A wrapper-shaped object for a module.
 * @param {string} moduleID - Module id.
 * @param {string} [apiPath] - Api path.
 * @returns {object} The fake wrapper.
 * @example
 * const w = wrapper("mod", "mod.fn");
 */
function wrapper(moduleID, apiPath) {
	return { ____slothletInternal: { moduleID, apiPath, incarnation: 1 } };
}

describe("EventManager.on — ceiling calls", () => {
	it("leaves a ceiling call without an api path out of the subscription's ceiling paths", async () => {
		const own = wrapper("mod", "mod.fn");
		const ceiling = {};
		const pm = { hasConditionalEventRules: false, eventRulesEpoch: 1, resolveEventLevel: vi.fn(() => "allow") };
		const em = new EventManager(makeSlothlet({ identity: () => ({ currentWrapper: own, ceiling }), pm }));
		const { level } = em.on("evt", () => {});
		expect(level).toBe("allow");
		// Only the subscriber's own path is resolved: the ceiling call has none.
		expect(pm.resolveEventLevel.mock.calls.map((c) => c[0])).toEqual(["mod.fn"]);
	});
});

describe("EventManager on a run's copy", () => {
	it("off() removes the listener from the copy the write target names", () => {
		const slothlet = makeSlothlet();
		const em = new EventManager(slothlet);
		const listener = () => {};
		em.on("evt", listener);
		const copy = em[FORK]();
		slothlet[WRITE_TARGET] = (component) => (component === em ? copy : component);
		expect(em.off("evt", listener)).toBe(true);
		slothlet[WRITE_TARGET] = undefined;
		// The original keeps its listener; only the copy lost it.
		expect(em.off("evt", listener)).toBe(true);
		expect(copy.off("evt", listener)).toBe(false);
	});

	it("strategy() installs on the copy the write target names", async () => {
		const slothlet = makeSlothlet();
		const em = new EventManager(slothlet);
		const copy = em[FORK]();
		const strategy = vi.fn();
		slothlet[WRITE_TARGET] = (component) => (component === em ? copy : component);
		em.strategy(strategy);
		slothlet[WRITE_TARGET] = undefined;
		expect(copy.exportStrategy()).toBe(strategy);
		expect(em.exportStrategy()).toBeNull();
	});

	it("an off() handed out before the fork removes the copy's record of that listener", async () => {
		const slothlet = makeSlothlet();
		const em = new EventManager(slothlet);
		const first = vi.fn();
		const second = vi.fn();
		em.on("evt", first);
		const { off } = em.on("evt", second);
		const copy = em[FORK]();
		slothlet[WRITE_TARGET] = (component) => (component === em ? copy : component);
		off();
		// The bucket is gone once its last record is: a second removal finds nothing to remove.
		copy.off("evt", first);
		off();
		slothlet[WRITE_TARGET] = undefined;
		await copy.emit("evt", 1);
		expect(first).not.toHaveBeenCalled();
		expect(second).not.toHaveBeenCalled();
		// The original still delivers to both.
		await em.emit("evt", 2);
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});
});

describe("EventManager dispatch — a removed module's listener", () => {
	it("is dropped instead of delivered", async () => {
		const own = wrapper("gone", "gone.fn");
		let current = own;
		const apiManager = { isRemovedCaller: vi.fn((w) => w === own) };
		const em = new EventManager(makeSlothlet({ identity: () => (current ? { currentWrapper: current } : null), apiManager }));
		const listener = vi.fn();
		em.on("evt", listener);
		current = null;
		await em.emit("evt", 1);
		expect(listener).not.toHaveBeenCalled();
		expect(em.off("evt", listener)).toBe(false);
	});
});

describe("EventManager strategy — recipients denied at emit", () => {
	it("leaves a listener denied at emit time off the envelope", async () => {
		let level = "allow";
		const pm = { hasConditionalEventRules: true, eventRulesEpoch: 1, resolveEventLevel: () => level };
		const em = new EventManager(makeSlothlet({ pm }));
		em.on("evt", () => {});
		let seen = null;
		em.strategy((envelope) => {
			seen = envelope;
		});
		level = "deny";
		await em.emit("evt", 1);
		expect(seen.listeners).toEqual([]);
		expect(seen.levels).toEqual({});
	});
});

describe("EventManager strategy installed by a removed module", () => {
	it("delivers immediately once its installer is gone", async () => {
		const installer = wrapper("plug", "plug.fn");
		let current = installer;
		const apiManager = { isRemovedCaller: vi.fn((w) => w === installer) };
		const slothlet = makeSlothlet({ identity: () => (current ? { currentWrapper: current } : null), apiManager });
		slothlet.contextManager.runInContext = vi.fn();
		const em = new EventManager(slothlet);
		const strategy = vi.fn();
		em.strategy(strategy);
		current = null;
		const listener = vi.fn();
		em.on("evt", listener);
		await em.emit("evt", 7);
		expect(strategy).not.toHaveBeenCalled();
		expect(slothlet.contextManager.runInContext).not.toHaveBeenCalled();
		expect(listener).toHaveBeenCalledWith(7, expect.objectContaining({ event: "evt" }));
	});
});
