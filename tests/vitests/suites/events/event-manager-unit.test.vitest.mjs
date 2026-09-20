/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-manager-unit.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit coverage for EventManager (#407) edge paths not exercised by the
 * full-instance event-system suite.
 *
 * @description
 * The integration suite drives `api.slothlet.event` on a real instance and uses the `{ off }`
 * closure returned by `on`, so it never reaches: the `on`/`emit` argument guards, the standalone
 * `off(event, listener)` method, the no-permission-manager delivery default, the conditional-rule
 * re-resolution + deny-downgrade at emit, the async-listener rejection isolation, the silent-warn
 * short-circuit, and the double-`off` remove guard. These are covered here by constructing
 * EventManager directly with a minimal mock instance.
 *
 * @module tests/vitests/suites/events/event-manager-unit.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { EventManager } from "#handlers/event-manager";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Build a minimal mock Slothlet instance for EventManager.
 * @param {object} [opts] - Options.
 * @param {object|undefined} [opts.pm] - permissionManager mock; omit for the "no permission manager" path.
 * @param {boolean} [opts.silent=false] - Instance silent flag (suppresses listener-error warnings).
 * @returns {object} Mock slothlet.
 */
function makeSlothlet({ pm, silent = false } = {}) {
	const handlers = {};
	if (pm !== undefined) handlers.permissionManager = pm;
	return {
		SlothletError,
		SlothletWarning,
		instanceID: "evt-unit",
		config: { silent },
		contextManager: {
			getCallerIdentity: () => null,
			runInContext: undefined,
			tryGetContext: () => null
		},
		handlers
	};
}

/**
 * Build a mock permission manager for level resolution.
 * @param {Function} resolveFn - (subscriberPath, event, ctx) => "deny"|"notify"|"allow".
 * @param {object} [opts] - Options.
 * @param {boolean} [opts.conditional=false] - hasConditionalEventRules.
 * @param {number} [opts.epoch=1] - eventRulesEpoch.
 * @returns {object} Mock permission manager.
 */
function makePm(resolveFn, { conditional = false, epoch = 1 } = {}) {
	return { hasConditionalEventRules: conditional, eventRulesEpoch: epoch, resolveEventLevel: resolveFn };
}

// ── on() argument guards ─────────────────────────────────────────────────────

describe("EventManager.on — argument validation", () => {
	it("throws INVALID_ARGUMENT for a non-string event", () => {
		const em = new EventManager(makeSlothlet());
		expect(() => em.on(123, () => {})).toThrow(/INVALID_ARGUMENT/);
	});

	it("throws INVALID_ARGUMENT for an empty-string event", () => {
		const em = new EventManager(makeSlothlet());
		expect(() => em.on("", () => {})).toThrow(/INVALID_ARGUMENT/);
	});

	it("throws INVALID_ARGUMENT for a non-function listener", () => {
		const em = new EventManager(makeSlothlet());
		expect(() => em.on("evt", "not-a-function")).toThrow(/INVALID_ARGUMENT/);
	});
});

// ── #levelFor: no permission manager → allow ────────────────────────────────

describe("EventManager.#levelFor — no permission manager", () => {
	it("resolves every subscriber to allow and delivers the full payload when no permission manager exists", async () => {
		const em = new EventManager(makeSlothlet()); // handlers has no permissionManager
		let got;
		const { level } = em.on("orders.created", (payload, meta) => {
			got = { payload, meta };
		});
		expect(level).toBe("allow");
		await em.emit("orders.created", { id: 7 });
		expect(got.payload).toEqual({ id: 7 });
		expect(got.meta.event).toBe("orders.created");
	});
});

// ── off(event, listener) standalone method ──────────────────────────────────

describe("EventManager.off — standalone removal method", () => {
	it("returns false when the event has no subscribers", () => {
		const em = new EventManager(makeSlothlet());
		expect(em.off("never-subscribed", () => {})).toBe(false);
	});

	it("removes a matching listener and returns true", async () => {
		const em = new EventManager(makeSlothlet());
		const fn = vi.fn();
		em.on("evt", fn);
		expect(em.off("evt", fn)).toBe(true);
		await em.emit("evt", {});
		expect(fn).not.toHaveBeenCalled();
	});

	it("returns false when no subscription matches on an event that has subscribers", () => {
		const em = new EventManager(makeSlothlet());
		em.on("evt", () => {});
		expect(em.off("evt", () => {})).toBe(false); // different listener reference
	});
});

// ── emit() argument guard ────────────────────────────────────────────────────

describe("EventManager.emit — argument validation", () => {
	it("throws INVALID_ARGUMENT for a non-string event", async () => {
		const em = new EventManager(makeSlothlet());
		await expect(em.emit(123)).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("throws INVALID_ARGUMENT for an empty-string event", async () => {
		const em = new EventManager(makeSlothlet());
		await expect(em.emit("")).rejects.toThrow(/INVALID_ARGUMENT/);
	});
});

// ── Conditional rules + deny-downgrade at emit ──────────────────────────────

describe("EventManager — conditional level re-resolution and deny-downgrade at emit", () => {
	it("re-resolves a conditional subscriber each emit and drops it when it downgrades to deny", async () => {
		let current = "allow";
		const pm = makePm(() => current, { conditional: true });
		const em = new EventManager(makeSlothlet({ pm }));
		const fn = vi.fn();
		const { level } = em.on("evt", fn);
		expect(level).toBe("allow");

		await em.emit("evt", { n: 1 });
		expect(fn).toHaveBeenCalledTimes(1);

		// A conditional rule now resolves to deny → the subscriber is dropped at emit and never fires again.
		current = "deny";
		await em.emit("evt", { n: 2 });
		expect(fn).toHaveBeenCalledTimes(1);

		// Confirm it was actually removed: even flipping back to allow yields nothing (subscription gone).
		current = "allow";
		await em.emit("evt", { n: 3 });
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("delivers only the trigger envelope (no payload) at notify level", async () => {
		const pm = makePm(() => "notify");
		const em = new EventManager(makeSlothlet({ pm }));
		let got;
		const { level } = em.on("evt", (payload, meta) => {
			got = { payload, meta };
		});
		expect(level).toBe("notify");
		await em.emit("evt", { secret: true });
		expect(got.payload).toBeUndefined();
		expect(got.meta.event).toBe("evt");
	});

	it("refuses a deny subscription at registration and hands back a no-op off", async () => {
		const pm = makePm(() => "deny");
		const em = new EventManager(makeSlothlet({ pm }));
		const fn = vi.fn();
		const { level, off } = em.on("evt", fn);
		expect(level).toBe("deny");
		expect(() => off()).not.toThrow();
		await em.emit("evt", {});
		expect(fn).not.toHaveBeenCalled();
	});
});

// ── Async listener rejection isolation ──────────────────────────────────────

describe("EventManager.emit — async listener error isolation", () => {
	it("awaits async listeners and isolates a rejecting one behind a warning", async () => {
		SlothletWarning.suppressConsole = true;
		try {
			const em = new EventManager(makeSlothlet());
			const good = vi.fn();
			em.on("evt", async () => {
				throw new Error("async boom");
			});
			em.on("evt", async () => {
				good("ok");
			});
			await expect(em.emit("evt", {})).resolves.toBeUndefined();
			expect(good).toHaveBeenCalledWith("ok");
		} finally {
			SlothletWarning.suppressConsole = false;
		}
	});

	it("isolates a synchronously-throwing listener and still runs the others (non-silent → warns)", async () => {
		SlothletWarning.suppressConsole = true;
		try {
			const em = new EventManager(makeSlothlet());
			const after = vi.fn();
			em.on("evt", () => {
				throw new Error("sync boom");
			});
			em.on("evt", () => after("ran"));
			await em.emit("evt", {});
			expect(after).toHaveBeenCalledWith("ran");
		} finally {
			SlothletWarning.suppressConsole = false;
		}
	});
});

// ── Silent instance suppresses the listener-error warning ───────────────────

describe("EventManager.#warnListener — silent instance", () => {
	it("does not surface a warning for a throwing listener when the instance is silent", async () => {
		// silent:true → #warnListener returns before constructing the warning; a second listener still runs.
		const em = new EventManager(makeSlothlet({ silent: true }));
		const after = vi.fn();
		em.on("evt", () => {
			throw new Error("boom");
		});
		em.on("evt", () => after("ran"));
		await expect(em.emit("evt", {})).resolves.toBeUndefined();
		expect(after).toHaveBeenCalledWith("ran");
	});
});

// ── Double off() → #removeSub guard when the bucket is already gone ──────────

describe("EventManager — double unsubscribe", () => {
	it("tolerates calling the returned off() twice (second removeSub finds no bucket)", () => {
		const em = new EventManager(makeSlothlet());
		const { off } = em.on("evt", () => {});
		off(); // removes the only sub and prunes the empty bucket
		expect(() => off()).not.toThrow(); // second call: #removeSub returns early on the missing set
	});

	it("keeps the event bucket when other subscribers remain (removeSub set.size !== 0)", async () => {
		const em = new EventManager(makeSlothlet());
		const fnA = vi.fn();
		const fnB = vi.fn();
		em.on("evt", fnA);
		const { off } = em.on("evt", fnB);
		off(); // removes fnB only; fnA remains → the bucket must NOT be deleted
		await em.emit("evt", { x: 1 });
		expect(fnA).toHaveBeenCalledTimes(1);
		expect(fnB).not.toHaveBeenCalled();
	});
});

// ── resolveLevel(subscriberPath, event) — host-side level query ──────────────

describe("EventManager.resolveLevel — validation and delegation", () => {
	it("throws INVALID_ARGUMENT for a non-string event", () => {
		const em = new EventManager(makeSlothlet());
		expect(() => em.resolveLevel("some.path", 123)).toThrow(/INVALID_ARGUMENT/);
	});

	it("throws INVALID_ARGUMENT for an empty-string event", () => {
		const em = new EventManager(makeSlothlet());
		expect(() => em.resolveLevel("some.path", "")).toThrow(/INVALID_ARGUMENT/);
	});

	it("throws INVALID_ARGUMENT for a subscriberPath that is neither a string nor null", () => {
		const em = new EventManager(makeSlothlet());
		expect(() => em.resolveLevel(42, "evt")).toThrow(/INVALID_ARGUMENT/);
		expect(() => em.resolveLevel({}, "evt")).toThrow(/INVALID_ARGUMENT/);
	});

	it("returns allow when no permission manager exists (ungated), for any path including null", () => {
		const em = new EventManager(makeSlothlet()); // handlers has no permissionManager
		expect(em.resolveLevel("any.path", "evt")).toBe("allow");
		expect(em.resolveLevel(null, "evt")).toBe("allow");
	});

	it("delegates to the permission manager, forwarding path, event, and the current runtime context", () => {
		const seen = [];
		const pm = makePm((subscriberPath, event, ctx) => {
			seen.push({ subscriberPath, event, ctx });
			return subscriberPath === "reporting.dash" ? "allow" : "notify";
		});
		const slothlet = makeSlothlet({ pm });
		slothlet.contextManager.tryGetContext = () => ({ tenant: "acme" });
		const em = new EventManager(slothlet);
		expect(em.resolveLevel("reporting.dash", "orders.created")).toBe("allow");
		expect(em.resolveLevel("other.mod", "orders.created")).toBe("notify");
		expect(seen[0]).toEqual({ subscriberPath: "reporting.dash", event: "orders.created", ctx: { tenant: "acme" } });
	});

	it("passes a null subscriberPath through to the resolver unchanged (host subscription)", () => {
		const pm = makePm((subscriberPath) => (subscriberPath == null ? "allow" : "deny"));
		const em = new EventManager(makeSlothlet({ pm }));
		expect(em.resolveLevel(null, "evt")).toBe("allow");
		expect(em.resolveLevel("mod.x", "evt")).toBe("deny");
	});
});
