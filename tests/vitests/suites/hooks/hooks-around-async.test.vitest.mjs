/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-around-async.test.vitest.mjs
 *	@Date: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:17 -07:00 (1791083057)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Sync/async dispatch of `around` hooks (#496), and the async-context use case the
 * hook exists for.
 *
 * @description
 * Around hooks follow the same rule as before/after: a synchronous around keeps a synchronous call
 * synchronous (`next()` returns the plain value); an async one — native async brand, or registered
 * with `{ async: true }` — promotes the call to the asynchronous pipeline, with the promotion guard
 * and the per-path strategy cache. A synchronous around returning a thenable it did not get from
 * `next()` fails loudly with `HOOK_AROUND_RETURNED_PROMISE`.
 *
 * The use case (#496): an around hook that runs `next()` inside `AsyncLocalStorage.run(store, …)`
 * makes that store visible to the target — including after an `await` inside the target.
 */

import { describe, it, expect, afterEach } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

// Minimal boot base; targets are mounted inline per test.
const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/** Application-owned async context the around hooks establish. */
const requestStore = new AsyncLocalStorage();

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
			await Promise.resolve();
			return a * b;
		},
		/**
		 * A plain (not `async`-declared) function that returns a Promise.
		 * @param {number} a - Left operand.
		 * @param {number} b - Right operand.
		 * @returns {Promise<number>} Product.
		 */
		mulThenable(a, b) {
			return Promise.resolve(a * b);
		},
		/**
		 * A plain (not `async`-declared) function that returns a rejected Promise.
		 * @param {string} message - Error message.
		 * @returns {Promise<never>} Rejection.
		 */
		rejectThenable(message) {
			return Promise.reject(new Error(message));
		},
		/**
		 * Rejects after a tick.
		 * @param {string} message - Error message.
		 * @returns {Promise<never>} Rejection.
		 */
		async failAsync(message) {
			await Promise.resolve();
			throw new Error(message);
		},
		/**
		 * Reads the application store synchronously.
		 * @returns {string|undefined} The active request id.
		 */
		whoSync() {
			return requestStore.getStore()?.requestId;
		},
		/**
		 * Reads the application store before and after an await.
		 * @returns {Promise<Array<string|undefined>>} The request id seen on both sides of the await.
		 */
		async whoAsync() {
			const before = requestStore.getStore()?.requestId;
			await new Promise((resolve) => setTimeout(resolve, 5));
			const after = requestStore.getStore()?.requestId;
			return [before, after];
		}
	}
};

/**
 * Boots an api with hooks enabled over the shared base and mounts the targets.
 * @param {object} config - Matrix configuration for this run.
 * @returns {Promise<object>} The bound api.
 */
async function boot(config) {
	const api = await slothlet({ ...config, base: BASE, hook: { enabled: true } });
	await api.slothlet.api.add("svc", TARGETS);
	return api;
}

/**
 * Captures a synchronous or asynchronous failure of a call.
 * @param {function(): *} fn - Thunk making the call.
 * @returns {Promise<{ok: boolean, value?: *, error?: *}>} Outcome.
 */
async function outcome(fn) {
	try {
		return { ok: true, value: await fn() };
	} catch (error) {
		return { ok: false, error };
	}
}

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hooks > around sync/async dispatch (#496) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a sync around keeps a sync target synchronous: next() and the call return plain values", async () => {
		api = await boot(config);
		const fromNext = [];
		api.slothlet.hook.on(
			"svc.mulSync:around",
			({ next }) => {
				const value = next();
				fromNext.push(typeof value);
				return value + 1;
			},
			{ id: "sync-around" }
		);

		const out = api.svc.mulSync(2, 3);
		expect(typeof out).toBe("number");
		expect(out).toBe(7);
		expect(fromNext).toEqual(["number"]);
	});

	it("an async around promotes a sync target; the promoted return is guarded", async () => {
		api = await boot(config);
		api.slothlet.hook.on(
			"svc.mulSync:around",
			async ({ next }) => {
				await Promise.resolve();
				return (await next()) * 10;
			},
			{ id: "async-around" }
		);

		const pending = api.svc.mulSync(2, 3);
		expect(typeof pending.then).toBe("function");
		expect(() => pending * 1).toThrow(/svc\.mulSync/);
		expect(await pending).toBe(60);
	});

	it("removing the async around restores synchronous returns", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mulSync:around", async ({ next }) => next(), { id: "async-around" });
		expect(await api.svc.mulSync(2, 3)).toBe(6);

		api.slothlet.hook.remove({ id: "async-around" });
		api.slothlet.hook.on("svc.mulSync:around", ({ next }) => next(), { id: "sync-around" });
		const out = api.svc.mulSync(2, 3);
		expect(typeof out).toBe("number");
		expect(out).toBe(6);
	});

	it("a plain handler declared { async: true } promotes like a native async one", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mulSync:around", ({ next }) => Promise.resolve().then(() => next([4, 5])), {
			id: "declared",
			async: true
		});

		expect(await api.svc.mulSync(2, 3)).toBe(20);
	});

	it("an async around on an async target transforms the awaited result, unguarded", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mulAsync:around", async ({ next }) => (await next()) + 1, { id: "async-around" });

		const pending = api.svc.mulAsync(2, 3);
		expect(await pending).toBe(7);
		// Async targets already hand their callers a Promise, so it is not guarded.
		expect(String(api.svc.mulAsync(1, 1))).toBe("[object Promise]");
	});

	it("a sync around over an async target passes the target Promise through, after hooks applied", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mulAsync:after", ({ result }) => result + 100, { id: "after" });
		api.slothlet.hook.on("svc.mulAsync:around", ({ next }) => next(), { id: "sync-around" });

		expect(await api.svc.mulAsync(2, 3)).toBe(106);
	});

	it("a sync around may pass through the Promise a plain promise-returning target produced", async () => {
		api = await boot(config);
		const always = [];
		api.slothlet.hook.on("svc.mulThenable:after", ({ result }) => result + 1, { id: "after" });
		api.slothlet.hook.on("svc.mulThenable:always", ({ result }) => always.push(result), { id: "always" });
		api.slothlet.hook.on("svc.mulThenable:around", ({ next }) => next(), { id: "pass-through" });

		expect(await api.svc.mulThenable(2, 3)).toBe(7);
		expect(always).toEqual([7]);
	});

	it("an undeclared thenable from a sync around fails loudly with HOOK_AROUND_RETURNED_PROMISE", async () => {
		api = await boot(config);
		const sources = [];
		api.slothlet.hook.on("svc.mulSync:error", ({ error, source }) => sources.push({ code: error.code, type: source.type }), { id: "er" });
		// A plain function returning a Promise reads as synchronous — the brand check cannot see it.
		api.slothlet.hook.on("svc.mulSync:around", ({ next }) => Promise.resolve(next()), { id: "undeclared" });

		const result = await outcome(() => api.svc.mulSync(2, 3));
		expect(result.ok).toBe(false);
		expect(result.error.code).toBe("HOOK_AROUND_RETURNED_PROMISE");
		expect(result.error.message).toContain("undeclared");
		expect(sources).toEqual([{ code: "HOOK_AROUND_RETURNED_PROMISE", type: "around" }]);
	});

	it("a sync around deriving a new thenable from next() is refused too — only pass-through is allowed", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mulThenable:around", ({ next }) => next().then((value) => value * 2), { id: "derived" });

		const result = await outcome(() => api.svc.mulThenable(2, 3));
		expect(result.error.code).toBe("HOOK_AROUND_RETURNED_PROMISE");
	});

	it("async pipeline error flow: a swallowed rejection is hidden from error hooks, a rethrown one is not", async () => {
		api = await boot(config);
		const errors = [];
		api.slothlet.hook.on("svc.failAsync:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
		const swallowId = api.slothlet.hook.on(
			"svc.failAsync:around",
			async ({ next }) => {
				try {
					return await next();
				} catch {
					return "fallback";
				}
			},
			{ id: "swallow" }
		);

		expect(await api.svc.failAsync("gone")).toBe("fallback");
		expect(errors).toEqual([]);

		api.slothlet.hook.remove({ id: swallowId });
		const rolledBack = [];
		api.slothlet.hook.on(
			"svc.failAsync:around",
			async ({ next }) => {
				try {
					return await next();
				} catch (error) {
					rolledBack.push(error.message);
					throw error;
				}
			},
			{ id: "rethrow" }
		);
		const result = await outcome(() => api.svc.failAsync("seen"));
		expect(result.error.message).toBe("seen");
		expect(rolledBack).toEqual(["seen"]);
		expect(errors).toEqual(["seen:function"]);
	});

	it("#496: next() inside AsyncLocalStorage.run makes the store visible to a sync target", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.whoSync:around", ({ next }) => requestStore.run({ requestId: "req-1" }, () => next()), { id: "als" });

		expect(api.svc.whoSync()).toBe("req-1");
		expect(requestStore.getStore(), "the store does not leak out of the call").toBeUndefined();
	});

	it("#496: the store survives an await inside the target (sync around)", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.whoAsync:around", ({ next }) => requestStore.run({ requestId: "req-2" }, () => next()), { id: "als" });

		expect(await api.svc.whoAsync()).toEqual(["req-2", "req-2"]);
	});

	it("#496: the store survives an await inside the target (async around, before hooks awaited first)", async () => {
		api = await boot(config);
		// An async before hook forces an await ahead of the target inside the pipeline next() runs.
		api.slothlet.hook.on(
			"svc.whoAsync:before",
			async () => {
				await Promise.resolve();
			},
			{ id: "async-before" }
		);
		api.slothlet.hook.on(
			"svc.whoAsync:around",
			async ({ next }) => {
				await Promise.resolve();
				return requestStore.run({ requestId: "req-3" }, () => next());
			},
			{ id: "als" }
		);

		expect(await api.svc.whoAsync()).toEqual(["req-3", "req-3"]);
	});

	it("async pipeline: before and after hook failures reach the around hook with their own sources", async () => {
		api = await boot(config);
		const sources = [];
		const caught = [];
		api.slothlet.hook.on("svc.mulSync:error", ({ source }) => sources.push(source.type), { id: "er" });
		api.slothlet.hook.on(
			"svc.mulSync:around",
			async ({ next }) => {
				try {
					return await next();
				} catch (error) {
					caught.push(error.message);
					throw error;
				}
			},
			{ id: "ar" }
		);
		const beforeId = api.slothlet.hook.on(
			"svc.mulSync:before",
			async () => {
				throw new Error("pre");
			},
			{ id: "be" }
		);

		expect((await outcome(() => api.svc.mulSync(1, 2))).error.message).toBe("pre");
		api.slothlet.hook.remove({ id: beforeId });
		api.slothlet.hook.on(
			"svc.mulSync:after",
			async () => {
				throw new Error("post");
			},
			{ id: "af" }
		);
		expect((await outcome(() => api.svc.mulSync(1, 2))).error.message).toBe("post");

		expect(caught).toEqual(["pre", "post"]);
		expect(sources).toEqual(["before", "after"]);
	});

	it("a passed-through rejection from a plain promise-returning target reaches error and always hooks", async () => {
		api = await boot(config);
		const errors = [];
		const always = [];
		api.slothlet.hook.on("svc.rejectThenable:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
		api.slothlet.hook.on("svc.rejectThenable:always", ({ hasError }) => always.push(hasError), { id: "al" });
		api.slothlet.hook.on("svc.rejectThenable:around", ({ next }) => next(), { id: "pass-through" });

		const result = await outcome(() => api.svc.rejectThenable("late"));
		expect(result.error.message).toBe("late");
		expect(errors).toEqual(["late:function"]);
		expect(always).toEqual([true]);
	});

	it("an async before hook promotes the call with a sync around in place", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mulSync:before", async ({ args }) => [args[0] * 2, args[1]], { id: "async-before" });
		api.slothlet.hook.on("svc.mulSync:around", ({ next }) => next(), { id: "sync-around" });

		const pending = api.svc.mulSync(2, 3);
		expect(() => `${pending}`).toThrow(/svc\.mulSync/);
		expect(await pending).toBe(12);
	});
});

describe("Hooks > around dispatch strategy (#496)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("reports around hooks in the cached per-path strategy and invalidates on change", async () => {
		const { resolveWrapper } = await import("#handlers/unified-wrapper");
		api = await boot({ mode: "eager" });
		const hookManager = resolveWrapper(api.svc).slothlet.handlers.hookManager;

		expect(hookManager.getDispatchStrategy("svc.mulSync")).toMatchObject({ hasAround: false, asyncAround: false });

		api.slothlet.hook.on("svc.*:around", ({ next }) => next(), { id: "sync" });
		const strategy = hookManager.getDispatchStrategy("svc.mulSync");
		expect(strategy).toMatchObject({ hasAround: true, asyncAround: false });
		expect(hookManager.getDispatchStrategy("svc.mulSync"), "cached").toBe(strategy);

		api.slothlet.hook.on("svc.*:around", async ({ next }) => next(), { id: "async" });
		expect(hookManager.getDispatchStrategy("svc.mulSync")).toMatchObject({ hasAround: true, asyncAround: true });

		api.slothlet.hook.disable({ type: "around" });
		expect(hookManager.getDispatchStrategy("svc.mulSync")).toMatchObject({ hasAround: false, asyncAround: false });
	});

	it("preserves an around hook's { async: true } declaration across a full reload", async () => {
		api = await boot({ mode: "eager" });
		api.slothlet.hook.on("svc.mulSync:around", ({ next }) => Promise.resolve().then(() => next()), { id: "declared", async: true });
		expect(await api.svc.mulSync(2, 3)).toBe(6);

		await api.slothlet.reload();
		expect(api.slothlet.hook.list({ type: "around" }).registeredHooks.map((hook) => hook.id)).toEqual(["declared"]);
		expect(await api.svc.mulSync(2, 3)).toBe(6);
	});
});
