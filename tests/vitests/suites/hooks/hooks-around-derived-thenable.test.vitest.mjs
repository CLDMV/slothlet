/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-around-derived-thenable.test.vitest.mjs
 *	@Date: 2026-10-11T10:43:19-07:00 (1791740599)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T19:36:37-07:00 (1792204597)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A synchronous around hook deriving a thenable from the thenable its `next()`
 * returned (#607).
 *
 * @description
 * On the synchronous pipeline a handler may return a thenable when it called `next()` and `next()`
 * returned a thenable: the caller already receives a thenable, so `next().then(check)` introduces no
 * asynchrony the target did not. A thenable is still refused with `HOOK_AROUND_RETURNED_PROMISE` when
 * the handler never called `next()`, or when `next()` returned a plain value. A rejection of the
 * derived thenable reaches the error hooks — with the `function` source when the target rejected,
 * and the `around` source when the handler's own continuation threw.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

// Minimal boot base; targets are mounted inline per test.
const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/**
 * A thenable that is not a native Promise: its `then` returns another of its kind, and it carries a method
 * of its own, as a cancellable request object does.
 */
class MyThen {
	/**
	 * @param {Promise<*>} promise - The native promise it fronts.
	 */
	constructor(promise) {
		this.promise = promise;
	}

	/**
	 * Register reactions, returning another MyThen.
	 * @param {Function} [onFulfilled] - Fulfillment reaction.
	 * @param {Function} [onRejected] - Rejection reaction.
	 * @returns {MyThen} The derived thenable.
	 */
	then(onFulfilled, onRejected) {
		return new MyThen(this.promise.then(onFulfilled, onRejected));
	}

	/**
	 * A method of its own, which a native Promise does not have.
	 * @returns {string} A marker.
	 */
	cancel() {
		return "cancelled";
	}
}

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
		 * A plain function returning a thenable that is not a native Promise.
		 * @param {number} a - Operand.
		 * @returns {MyThen} A thenable resolving to `a`.
		 */
		customThenable(a) {
			return new MyThen(Promise.resolve(a));
		}
	}
};

/**
 * Boots an api with hooks enabled over the shared base and mounts the targets.
 * @param {object} config - Matrix configuration for this run.
 * @returns {Promise<object>} The bound api.
 */
async function boot(config, hook = {}) {
	const api = await slothlet({ ...config, base: BASE, hook: { enabled: true, ...hook } });
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

describe.each(getMatrixConfigs({ hook: { enabled: true } }))(
	"Hooks > around derived thenable on the sync pipeline (#607) > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		it("a sync around may return next().then(check) when next() returned a thenable", async () => {
			api = await boot(config);
			const always = [];
			const errors = [];
			api.slothlet.hook.on("svc.mulThenable:after", ({ result }) => result + 1, { id: "after" });
			api.slothlet.hook.on("svc.mulThenable:always", ({ result }) => always.push(result), { id: "always" });
			api.slothlet.hook.on("svc.mulThenable:error", ({ error }) => errors.push(error.message), { id: "er" });
			api.slothlet.hook.on("svc.mulThenable:around", ({ next }) => next().then((value) => value * 2), { id: "derived" });

			const result = await outcome(() => api.svc.mulThenable(2, 3));
			expect(result).toEqual({ ok: true, value: 14 });
			expect(always).toEqual([14]);
			expect(errors).toEqual([]);
		});

		it("still refuses a thenable when next() returned a plain value", async () => {
			api = await boot(config);
			const sources = [];
			api.slothlet.hook.on("svc.mulSync:error", ({ error, source }) => sources.push({ code: error.code, type: source.type }), { id: "er" });
			api.slothlet.hook.on(
				"svc.mulSync:around",
				({ next }) => {
					const value = next();
					return Promise.resolve(value * 2);
				},
				{ id: "sync-target" }
			);

			const result = await outcome(() => api.svc.mulSync(2, 3));
			expect(result.ok).toBe(false);
			expect(result.error.code).toBe("HOOK_AROUND_RETURNED_PROMISE");
			expect(sources).toEqual([{ code: "HOOK_AROUND_RETURNED_PROMISE", type: "around" }]);
		});

		it("still refuses a thenable from a handler that short-circuits without calling next()", async () => {
			api = await boot(config);
			api.slothlet.hook.on("svc.mulThenable:around", () => Promise.resolve(42), { id: "short-circuit" });

			const result = await outcome(() => api.svc.mulThenable(2, 3));
			expect(result.ok).toBe(false);
			expect(result.error.code).toBe("HOOK_AROUND_RETURNED_PROMISE");
			expect(result.error.message).toContain("short-circuit");
		});

		it("a target rejection through the derived thenable reaches the error hooks with the function source", async () => {
			api = await boot(config);
			const errors = [];
			const always = [];
			api.slothlet.hook.on("svc.rejectThenable:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
			api.slothlet.hook.on("svc.rejectThenable:always", ({ hasError }) => always.push(hasError), { id: "always" });
			api.slothlet.hook.on("svc.rejectThenable:around", ({ next }) => next().then((value) => value), { id: "derived" });

			const result = await outcome(() => api.svc.rejectThenable("target gone"));
			expect(result.ok).toBe(false);
			expect(result.error.message).toBe("target gone");
			expect(errors).toEqual(["target gone:function"]);
			expect(always).toEqual([true]);
		});

		it("a throw from the handler's own .then(check) reaches the error hooks with the around source", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on(
				"svc.mulThenable:error",
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId}`),
				{
					id: "er"
				}
			);
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) =>
					next().then(() => {
						throw new Error("check failed");
					}),
				{ id: "checker" }
			);

			const result = await outcome(() => api.svc.mulThenable(2, 3));
			expect(result.ok).toBe(false);
			expect(result.error.message).toBe("check failed");
			expect(errors).toEqual(["check failed:around:checker"]);
		});

		it("a rejection the derived thenable recovers from is hidden from the error hooks", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on("svc.rejectThenable:error", ({ error }) => errors.push(error.message), { id: "er" });
			api.slothlet.hook.on("svc.rejectThenable:around", ({ next }) => next().then(undefined, () => "fallback"), { id: "recover" });

			expect(await api.svc.rejectThenable("target gone")).toBe("fallback");
			expect(errors).toEqual([]);
		});

		it("nests: an outer hook may derive from an inner hook's derived thenable", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on(
				"svc.mulThenable:error",
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId}`),
				{
					id: "er"
				}
			);
			api.slothlet.hook.on("svc.mulThenable:around", ({ next }) => next().then((value) => value * 10), { id: "outer", priority: 10 });
			api.slothlet.hook.on("svc.mulThenable:around", ({ next }) => next().then((value) => value + 1), { id: "inner", priority: 1 });

			expect(await api.svc.mulThenable(2, 3)).toBe(70);
			expect(errors).toEqual([]);
		});

		it("a thenable derived from a non-native one keeps its kind, as .then on it does in plain JS", async () => {
			api = await boot(config);
			api.slothlet.hook.on("svc.customThenable:around", ({ next }) => next().then((value) => value * 2), { id: "derived" });

			const result = api.svc.customThenable(4);
			expect(typeof result.cancel).toBe("function");
			expect(result.cancel()).toBe("cancelled");
			expect(await result).toBe(8);
		});

		it("accepts any thenable once next() returned one, which adds no asynchrony the target did not", async () => {
			api = await boot(config);
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) => {
					next();
					return Promise.resolve("replaced");
				},
				{ id: "replace" }
			);

			expect(await api.svc.mulThenable(2, 3)).toBe("replaced");
		});

		it("with errors suppressed, a derived rejection resolves to undefined and reaches the error hooks once", async () => {
			api = await boot(config, { suppressErrors: true });
			const errors = [];
			api.slothlet.hook.on("svc.rejectThenable:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
			api.slothlet.hook.on("svc.rejectThenable:around", ({ next }) => next().then((value) => value), { id: "derived" });

			expect(await api.svc.rejectThenable("target gone")).toBeUndefined();
			expect(errors).toEqual(["target gone:function"]);
		});

		it("nests: a target rejection through two derived thenables is reported once, with the function source", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on("svc.rejectThenable:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
			api.slothlet.hook.on("svc.rejectThenable:around", ({ next }) => next().then((value) => value), { id: "outer", priority: 10 });
			api.slothlet.hook.on("svc.rejectThenable:around", ({ next }) => next().then((value) => value), { id: "inner", priority: 1 });

			const result = await outcome(() => api.svc.rejectThenable("target gone"));
			expect(result.ok).toBe(false);
			expect(errors).toEqual(["target gone:function"]);
		});

		it("nests: a throw in the inner hook's continuation keeps the inner hook as its source", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on(
				"svc.mulThenable:error",
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId}`),
				{
					id: "er"
				}
			);
			api.slothlet.hook.on("svc.mulThenable:around", ({ next }) => next().then((value) => value * 10), { id: "outer", priority: 10 });
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) =>
					next().then(() => {
						throw new Error("inner check failed");
					}),
				{ id: "inner", priority: 1 }
			);

			const result = await outcome(() => api.svc.mulThenable(2, 3));
			expect(result.ok).toBe(false);
			expect(result.error.message).toBe("inner check failed");
			expect(errors).toEqual(["inner check failed:around:inner"]);
		});
	}
);
