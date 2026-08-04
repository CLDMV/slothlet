/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-transparent-dispatch.test.vitest.mjs
 *	@Date: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Any mix of sync/async targets and handlers composes correctly (#253, closes #251).
 *
 * @description
 * Hook handlers used to be required synchronous: an async `before` handler threw
 * `HOOK_BEFORE_RETURNED_PROMISE` regardless of the target's own sync-ness, and an async `after`
 * handler on a sync target silently leaked a pending Promise as the return value (#251 — NaN under
 * arithmetic, no error). Dispatch is now derived PER CALL from the current hook set: a path whose
 * matching before/after handlers include an async one runs an asynchronous pipeline (awaiting only
 * actual thenables, strict registration order preserved); a path with only sync handlers keeps the
 * synchronous fast path byte-for-byte. Observers (`always`/`error`) never force promotion — their
 * return values are not consumed.
 *
 * A sync target promoted by an async hook returns a GUARDED Promise: `await` works normally, but
 * consuming it as a value (arithmetic, string coercion, JSON) throws a named error carrying the
 * path — the caller's code was correct when written and broke because another module attached a
 * hook, and the error says so. Removing the async hook returns the path to synchronous dispatch
 * (the strategy is a property of the call, never baked onto the leaf).
 *
 * The one silent-corruption cell left by detection blind spots is closed loudly: a SYNC pipeline
 * (no detectably-async handler registered) whose after handler returns a thenable now throws
 * `HOOK_AFTER_RETURNED_PROMISE` instead of leaking it — undetectable-async handlers either declare
 * `{ async: true }` at registration or fail at the call with a named error, never corrupt.
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

// Minimal boot base; targets are mounted inline per test.
const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/** Sync and async targets with identical arithmetic, per the #253 matrix. */
const TARGETS = {
	exports: {
		/**
		 * Synchronous target.
		 * @param {number} a - Left operand.
		 * @param {number} b - Right operand.
		 * @returns {number} Product.
		 */
		mulSync(a, b) {
			return a * b;
		},
		/**
		 * Asynchronous target.
		 * @param {number} a - Left operand.
		 * @param {number} b - Right operand.
		 * @returns {Promise<number>} Product.
		 */
		async mulAsync(a, b) {
			return a * b;
		}
	}
};

/**
 * Boots an api with hooks enabled over the shared base and mounts the matrix targets.
 * @param {object} config - Matrix configuration for this run.
 * @returns {Promise<object>} The bound api.
 */
async function boot(config) {
	const api = await slothlet({ ...config, base: BASE, hook: { enabled: true } });
	await api.slothlet.api.add("svc", TARGETS);
	return api;
}

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hooks > transparent dispatch (#253) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("before: async handler on a sync target transforms args (was refused)", async () => {
		api = await boot(config);
		api.slothlet.hook.on(
			"svc.mulSync:before",
			async ({ args }) => {
				const doubled = await Promise.resolve(args[0] * 2);
				return [doubled, args[1]];
			},
			{ id: "b-async-sync-target" }
		);

		// The pipeline is promoted, so the caller awaits — and gets the transformed computation.
		expect(await api.svc.mulSync(10, 2)).toBe(40);
	});

	it("before: async handler on an async target transforms args (was needlessly refused)", async () => {
		api = await boot(config);
		api.slothlet.hook.on(
			"svc.mulAsync:before",
			async ({ args }) => {
				const doubled = await Promise.resolve(args[0] * 2);
				return [doubled, args[1]];
			},
			{ id: "b-async-async-target" }
		);

		// The caller already receives a Promise and already awaits — refusing changed nothing
		// observable, which is why this cell was the unnecessary one.
		expect(await api.svc.mulAsync(10, 2)).toBe(40);
	});

	it("after: async handler on a sync target transforms the result (was the #251 leak)", async () => {
		api = await boot(config);
		api.slothlet.hook.on(
			"svc.mulSync:after",
			async ({ result }) => {
				const rate = await Promise.resolve(0.9);
				return result * rate;
			},
			{ id: "a-async-sync-target" }
		);

		// The exact #251 repro: 10 * 3 = 30, transformed to 27 — reachable by awaiting.
		const total = await api.svc.mulSync(10, 3);
		expect(total).toBe(27);
	});

	it("after: async handler on an async target keeps working", async () => {
		api = await boot(config);
		api.slothlet.hook.on(
			"svc.mulAsync:after",
			async ({ result }) => {
				const rate = await Promise.resolve(0.9);
				return result * rate;
			},
			{ id: "a-async-async-target" }
		);

		expect(await api.svc.mulAsync(10, 3)).toBe(27);
	});

	it("sync-only hooks keep the synchronous fast path — no promotion", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mulSync:before", ({ args }) => [args[0] + 1, args[1]], { id: "b-sync" });
		api.slothlet.hook.on("svc.mulSync:after", ({ result }) => result + 5, { id: "a-sync" });

		// A sync target with only sync handlers returns the VALUE synchronously, as always.
		const out = api.svc.mulSync(2, 3);
		expect(typeof out).toBe("number");
		expect(out).toBe(14); // (2+1)*3 + 5
	});

	it("observers never promote: an async always hook leaves a sync target synchronous", async () => {
		api = await boot(config);
		const seen = [];
		api.slothlet.hook.on(
			"svc.mulSync:always",
			async ({ result }) => {
				seen.push(result);
			},
			{ id: "always-async" }
		);

		// `always` return values are never consumed, so async-ness costs the caller nothing.
		const out = api.svc.mulSync(4, 5);
		expect(typeof out, "still a plain value").toBe("number");
		expect(out).toBe(20);
		// Give the observer's microtask a beat, then confirm it saw the call.
		await new Promise((r) => setImmediate(r));
		expect(seen).toEqual([20]);
	});

	it("preserves strict registration order across mixed handlers on both target kinds", async () => {
		api = await boot(config);
		const order = [];
		for (const [name, target] of [
			["sync", "svc.mulSync"],
			["async", "svc.mulAsync"]
		]) {
			order.length = 0;
			api.slothlet.hook.on(`${target}:before`, ({ args }) => (order.push(`${name}-b1-sync`), [args[0], args[1]]), {
				id: `${name}-b1`
			});
			api.slothlet.hook.on(
				`${target}:before`,
				async ({ args }) => {
					await Promise.resolve();
					order.push(`${name}-b2-async`);
					return [args[0], args[1]];
				},
				{ id: `${name}-b2` }
			);
			api.slothlet.hook.on(`${target}:before`, ({ args }) => (order.push(`${name}-b3-sync`), [args[0], args[1]]), {
				id: `${name}-b3`
			});
			api.slothlet.hook.on(
				`${target}:after`,
				async ({ result }) => {
					await Promise.resolve();
					order.push(`${name}-a1-async`);
					return result;
				},
				{ id: `${name}-a1` }
			);
			api.slothlet.hook.on(`${target}:after`, ({ result }) => (order.push(`${name}-a2-sync`), result), { id: `${name}-a2` });

			await (name === "sync" ? api.svc.mulSync(2, 3) : api.svc.mulAsync(2, 3));
			expect(order).toEqual([`${name}-b1-sync`, `${name}-b2-async`, `${name}-b3-sync`, `${name}-a1-async`, `${name}-a2-sync`]);
		}
	});

	it("chained before hooks feed transformed args forward through the async pipeline", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mulSync:before", async ({ args }) => [await Promise.resolve(args[0] * 2), args[1]], { id: "chain-1" });
		api.slothlet.hook.on("svc.mulSync:before", ({ args }) => [args[0] + 1, args[1]], { id: "chain-2" });

		// (10*2)+1 = 21, then * 3.
		expect(await api.svc.mulSync(10, 3)).toBe(63);
	});

	it("a sync before short-circuit still resolves through the promoted pipeline", async () => {
		api = await boot(config);
		let leafRan = false;
		await api.slothlet.api.add("probe", {
			exports: {
				/**
				 * Records execution so the short-circuit can prove the leaf never ran.
				 * @returns {string} Marker.
				 */
				watched() {
					leafRan = true;
					return "leaf";
				}
			}
		});
		api.slothlet.hook.on("probe.watched:before", () => "short-circuited", { id: "sc-sync" });
		// The async after hook promotes the path; the sync short-circuit must still win, resolved
		// through the async wrapper rather than bypassing it.
		api.slothlet.hook.on("probe.watched:after", async ({ result }) => result, { id: "sc-async-after" });

		expect(await api.probe.watched()).toBe("short-circuited");
		expect(leafRan, "target never invoked").toBe(false);
	});
});

describe("Hooks > transparent dispatch guards and reversibility (#253/#251)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("guards a promoted return: unawaited value use throws a named error, await works", async () => {
		api = await boot({ mode: "eager" });
		api.slothlet.hook.on("svc.mulSync:after", async ({ result }) => result * 0.9, { id: "promote" });

		const total = api.svc.mulSync(10, 3);
		// Consuming without awaiting used to yield NaN silently — the failure surfaced far from the
		// cause. It now throws, and the error names the path so the caller knows WHICH attachment
		// changed the contract under them.
		expect(() => total * 1.08).toThrow(/svc\.mulSync/);
		expect(() => `${total}`).toThrow(/svc\.mulSync/);
		// The legitimate consumption is untouched.
		expect(await total).toBe(27);
	});

	it("reverts to synchronous dispatch when the async hook is removed", async () => {
		api = await boot({ mode: "eager" });

		expect(api.svc.mulSync(1, 5), "no hooks: plain value").toBe(5);

		api.slothlet.hook.on("svc.mulSync:after", ({ result }) => result * 10, { id: "sync-x10" });
		expect(api.svc.mulSync(1, 5), "sync hook: still a plain value").toBe(50);

		api.slothlet.hook.on("svc.mulSync:after", async ({ result }) => result + 1, { id: "async-plus1" });
		const promoted = api.svc.mulSync(1, 5);
		expect(typeof promoted.then, "async hook: promoted").toBe("function");
		expect(await promoted).toBe(51);

		// The property that rules out any leaf-mutating design: removal must restore the original
		// contract. A mutate-based approach strands the leaf async permanently.
		api.slothlet.hook.remove({ id: "async-plus1" });
		expect(api.svc.mulSync(1, 5), "async hook removed: sync again").toBe(50);

		api.slothlet.hook.remove({ id: "sync-x10" });
		expect(api.svc.mulSync(1, 5), "all hooks removed: original value").toBe(5);
	});

	it("throws HOOK_AFTER_RETURNED_PROMISE when a sync pipeline meets an undetectable thenable", async () => {
		api = await boot({ mode: "eager" });
		// A PLAIN function returning a Promise is a detection blind spot: nothing registered on this
		// path is detectably async, so the pipeline stays sync — and the thenable it produces must
		// fail loudly instead of leaking as the return value (the #251 corruption, closed).
		api.slothlet.hook.on("svc.mulSync:after", ({ result }) => Promise.resolve(result * 0.9), { id: "blind-spot" });

		expect(() => api.svc.mulSync(10, 3)).toThrow(/HOOK_AFTER_RETURNED_PROMISE/);
	});

	it("honours the { async: true } registration override for undetectable handlers", async () => {
		api = await boot({ mode: "eager" });
		// Same blind-spot handler, but declared: the pipeline promotes and the cell works.
		api.slothlet.hook.on("svc.mulSync:after", ({ result }) => Promise.resolve(result * 0.9), {
			id: "declared-async",
			async: true
		});

		expect(await api.svc.mulSync(10, 3)).toBe(27);
	});

	it("rejects through the promoted pipeline when an async before handler throws", async () => {
		api = await boot({ mode: "eager" });
		api.slothlet.hook.on(
			"svc.mulSync:before",
			async () => {
				throw new Error("gate-refused");
			},
			{ id: "b-throwing" }
		);

		await expect(async () => await api.svc.mulSync(1, 1)).rejects.toThrow("gate-refused");
	});

	it("resolves undefined under suppressErrors when an async handler throws", async () => {
		api = await slothlet({ mode: "eager", base: BASE, hook: { enabled: true, suppressErrors: true } });
		await api.slothlet.api.add("svc", TARGETS);
		api.slothlet.hook.on(
			"svc.mulSync:before",
			async () => {
				throw new Error("suppressed");
			},
			{ id: "b-suppressed" }
		);

		expect(await api.svc.mulSync(1, 1)).toBeUndefined();
	});

	it("fires error hooks for an async after handler's rejection", async () => {
		api = await boot({ mode: "eager" });
		const seen = [];
		api.slothlet.hook.on(
			"svc.mulSync:after",
			async () => {
				throw new Error("after-boom");
			},
			{ id: "a-throwing" }
		);
		api.slothlet.hook.on("svc.mulSync:error", ({ error }) => seen.push(error.message), { id: "err-witness" });

		await expect(async () => await api.svc.mulSync(1, 1)).rejects.toThrow("after-boom");
		expect(seen).toContain("after-boom");
	});

	it("lets an async before observer return undefined without transforming anything", async () => {
		api = await boot({ mode: "eager" });
		const observed = [];
		api.slothlet.hook.on(
			"svc.mulSync:before",
			async ({ args }) => {
				await Promise.resolve();
				observed.push([...args]);
				// No return: observation only — the args flow through untouched.
			},
			{ id: "b-observer" }
		);

		expect(await api.svc.mulSync(6, 7)).toBe(42);
		expect(observed).toEqual([[6, 7]]);
	});

	it("suppresses a throwing async after handler and keeps the settled result", async () => {
		api = await slothlet({ mode: "eager", base: BASE, hook: { enabled: true, suppressErrors: true } });
		await api.slothlet.api.add("svc", TARGETS);
		const seen = [];
		api.slothlet.hook.on(
			"svc.mulSync:after",
			async () => {
				throw new Error("suppressed-after");
			},
			{ id: "a-suppressed" }
		);
		api.slothlet.hook.on("svc.mulSync:error", ({ error }) => seen.push(error.message), { id: "err-witness-2" });

		// Suppression skips the failed transform and keeps the chain alive — the target's own
		// result survives, and the failure is still visible to error hooks.
		expect(await api.svc.mulSync(2, 3)).toBe(6);
		expect(seen).toContain("suppressed-after");
	});

	it("serves non-function properties of the guarded promise faithfully", async () => {
		api = await boot({ mode: "eager" });
		api.slothlet.hook.on("svc.mulSync:after", async ({ result }) => result, { id: "promote-props" });

		const guarded = api.svc.mulSync(2, 2);
		// The guard intercepts only the value-coercion channels; everything else — including
		// non-function data like the brand tag — reads straight off the real promise.
		expect(guarded[Symbol.toStringTag]).toBe("Promise");
		expect(await guarded).toBe(4);
	});

	it("materializes an untouched lazy leaf inside the promoted pipeline", async () => {
		api = await slothlet({ mode: "lazy", base: BASE, hook: { enabled: true } });
		let sawBefore = false;
		api.slothlet.hook.on(
			"consumer.readViaSelf:before",
			async () => {
				await Promise.resolve();
				sawBefore = true;
			},
			{ id: "b-lazy-first-touch" }
		);

		// First-ever touch of this subtree: the promoted pipeline must await materialization
		// itself rather than relying on the sync path's polling promise.
		const seen = await api.consumer.readViaSelf();
		expect(sawBefore).toBe(true);
		expect(seen.keys).toEqual(["__priv", "_semi", "plain"]);
	});

	it("materializes a lazy top-level callable inside the promoted pipeline", async () => {
		// A chained first touch resolves through the waiting proxy, which materializes before the
		// leaf's own apply trap runs — so the pipeline's OWN materialize-await needs a call arriving
		// at an unmaterialized wrapper directly. A lazy TOP-LEVEL callable module is exactly that:
		// its proxy sits on the root object and the first call lands on the apply trap cold.
		const { resolveWrapper } = await import("#handlers/unified-wrapper");
		const { TEST_DIRS } = await import("../../setup/vitest-helper.mjs");
		api = await slothlet({ mode: "lazy", base: TEST_DIRS.API_TEST, hook: { enabled: true } });

		const wrapper = resolveWrapper(api.funcmod);
		expect(wrapper.____slothletInternal.state.materialized, "cold before the call").toBe(false);

		api.slothlet.hook.on("funcmod:after", async ({ result }) => `${result}-hooked`, { id: "a-cold-lazy" });
		expect(await api.funcmod("x"), "materialized and transformed in one promoted call").toBe("Hello, x!-hooked");
	});
});

describe("Hooks > transparent dispatch impl shapes (#253)", () => {
	let api;

	beforeEach(async () => {
		api = await boot({ mode: "eager" });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("promotes a { default: fn } impl and calls through the context manager", async () => {
		const { resolveWrapper } = await import("#handlers/unified-wrapper");
		const wrapper = resolveWrapper(api.svc.mulSync);
		const origImpl = wrapper.____slothletInternal.impl;
		// The default-export module shape: the wrapper's impl is an object whose `default` carries
		// the callable (same swap technique the sync-path impl-shape suite uses).
		wrapper.____slothletInternal.impl = { default: (a, b) => a * b };
		api.slothlet.hook.on("svc.mulSync:after", async ({ result }) => result + 1, { id: "d-async" });
		try {
			expect(await api.svc.mulSync(3, 4)).toBe(13);
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});

	it("promotes both callable shapes without a context manager", async () => {
		const { resolveWrapper } = await import("#handlers/unified-wrapper");
		const wrapper = resolveWrapper(api.svc.mulSync);
		const sl = wrapper.slothlet;
		const origImpl = wrapper.____slothletInternal.impl;
		const origCtx = sl.contextManager;
		api.slothlet.hook.on("svc.mulSync:after", async ({ result }) => result, { id: "noctx-async" });
		sl.contextManager = null;
		try {
			// Plain function impl, direct apply.
			expect(await api.svc.mulSync(3, 4)).toBe(12);
			// { default: fn } impl, direct apply.
			wrapper.____slothletInternal.impl = { default: (a, b) => a + b };
			expect(await api.svc.mulSync(3, 4)).toBe(7);
		} finally {
			sl.contextManager = origCtx;
			wrapper.____slothletInternal.impl = origImpl;
		}
	});

	it("rejects INVALID_CONFIG_NOT_A_FUNCTION for a non-callable impl", async () => {
		const { resolveWrapper } = await import("#handlers/unified-wrapper");
		const wrapper = resolveWrapper(api.svc.mulSync);
		const origImpl = wrapper.____slothletInternal.impl;
		wrapper.____slothletInternal.impl = { notAFunction: true };
		api.slothlet.hook.on("svc.mulSync:after", async ({ result }) => result, { id: "invalid-async" });
		try {
			let err;
			try {
				await api.svc.mulSync(1, 2);
			} catch (e) {
				err = e;
			}
			expect(err).toBeDefined();
			expect(err.code).toBe("INVALID_CONFIG_NOT_A_FUNCTION");
		} finally {
			wrapper.____slothletInternal.impl = origImpl;
		}
	});

	it("routes a throwing target through error hooks and rejects", async () => {
		const seen = [];
		await api.slothlet.api.add("boom", {
			exports: {
				/**
				 * Target whose own body throws under the promoted pipeline.
				 * @returns {never} Always throws.
				 */
				blow() {
					throw new Error("target-boom");
				}
			}
		});
		api.slothlet.hook.on("boom.blow:after", async ({ result }) => result, { id: "t-async" });
		api.slothlet.hook.on("boom.blow:error", ({ error }) => seen.push(error.message), { id: "t-err" });

		await expect(async () => await api.boom.blow()).rejects.toThrow("target-boom");
		expect(seen).toContain("target-boom");
	});

	it("does not double-process an error already marked by an inner hooked call", async () => {
		const errorHookFires = [];
		await api.slothlet.api.add("nest", {
			exports: {
				/**
				 * Inner target that fails; its own pipeline processes the error first.
				 * @returns {never} Always throws.
				 */
				inner() {
					throw new Error("nested-boom");
				},
				/**
				 * Outer target that re-raises the inner call's already-processed error.
				 * @param {object} boundApi - The bound api handle.
				 * @returns {Promise<never>} Always rejects.
				 */
				async outer(boundApi) {
					try {
						return await boundApi.nest.inner();
					} catch (e) {
						// Re-raise the PROCESSED original: the inner pipeline marked the root error it
						// handed to error hooks. (The context boundary may hand back a wrapper around
						// it — unwrap so the marker travels; the fallback keeps this correct once leaf
						// throws propagate unwrapped.)
						throw e.originalError ?? e;
					}
				}
			}
		});
		// Async hooks promote BOTH paths; the inner pipeline marks the error as processed, so the
		// outer pipeline must skip its error hooks rather than reporting the same failure twice.
		api.slothlet.hook.on("nest.inner:after", async ({ result }) => result, { id: "n-inner" });
		api.slothlet.hook.on("nest.outer:after", async ({ result }) => result, { id: "n-outer" });
		api.slothlet.hook.on("nest.**:error", ({ path }) => errorHookFires.push(path), { id: "n-err" });

		await expect(async () => await api.nest.outer(api)).rejects.toThrow("nested-boom");
		expect(errorHookFires, "processed once, at the inner pipeline").toEqual(["nest.inner"]);
	});

	it("resolves undefined for a throwing target under suppressErrors", async () => {
		const sup = await slothlet({ mode: "eager", base: BASE, hook: { enabled: true, suppressErrors: true } });
		try {
			await sup.slothlet.api.add("boom", {
				exports: {
					/**
					 * Suppressed-failure twin of the rejection case above.
					 * @returns {never} Always throws.
					 */
					blow() {
						throw new Error("suppressed-target");
					}
				}
			});
			sup.slothlet.hook.on("boom.blow:after", async ({ result }) => result, { id: "t-sup-async" });

			expect(await sup.boom.blow()).toBeUndefined();
		} finally {
			await sup.shutdown();
		}
	});
});
