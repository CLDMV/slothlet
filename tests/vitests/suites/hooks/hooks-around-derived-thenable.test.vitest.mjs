/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-around-derived-thenable.test.vitest.mjs
 *	@Date: 2026-10-11T10:43:19-07:00 (1791740599)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T21:59:39-07:00 (1792213179)
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

/**
 * A hand-written thenable whose `then` never calls its rejection callback and returns one of its own kind
 * that rejects: a rejection only the returned thenable carries.
 * @returns {{then: function(Function): MyThen}} The thenable.
 */
function rejectsUnseen() {
	return {
		then(onFulfilled) {
			return new MyThen(Promise.reject(new Error("unseen")).then(onFulfilled));
		}
	};
}

/**
 * A frozen thenable fronting a native promise: its own `then` is non-writable and non-configurable.
 * @param {Promise<*>} promise - The native promise it fronts.
 * @returns {{then: function(Function=, Function=): object}} The thenable.
 */
function frozen(promise) {
	return Object.freeze({
		then(onFulfilled, onRejected) {
			return frozen(promise.then(onFulfilled, onRejected));
		}
	});
}

/**
 * A frozen thenable whose `then` never calls its rejection callback and returns a frozen thenable that rejects.
 * @returns {{then: function(Function): object}} The thenable.
 */
function frozenRejectsUnseen() {
	return Object.freeze({
		then(onFulfilled) {
			return frozen(Promise.reject(new Error("unseen")).then(onFulfilled));
		}
	});
}

/**
 * A hand-written thenable that settles from a timer and whose `then` returns nothing, as a minimal
 * callback-style thenable does.
 * @param {boolean} reject - Whether it rejects.
 * @returns {{then: function(Function, Function): void}} The thenable.
 */
function later(reject) {
	return {
		then(onFulfilled, onRejected) {
			setTimeout(() => (reject ? onRejected(new Error("late")) : onFulfilled("late value")), 1);
		}
	};
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
		 * A plain function returning a Promise rejected with NaN, a value not equal to itself.
		 * @returns {Promise<never>} Rejection.
		 */
		rejectNaN() {
			return Promise.reject(NaN);
		},
		/**
		 * A plain function returning a thenable that is not a native Promise.
		 * @param {number} a - Operand.
		 * @returns {MyThen} A thenable resolving to `a`.
		 */
		customThenable(a) {
			return new MyThen(Promise.resolve(a));
		},
		/**
		 * A plain function returning a thenable whose `then` drops the rejection callback and rejects through
		 * the one of its own kind it returns.
		 * @returns {{then: function(Function): MyThen}} The thenable.
		 */
		dropsRejection() {
			return rejectsUnseen();
		},
		/**
		 * A plain function returning a thenable whose `then` drops the rejection callback and returns a native
		 * Promise that rejects.
		 * @returns {{then: function(Function): Promise<never>}} The thenable.
		 */
		frozenThenable(a, b) {
			return frozen(Promise.resolve(a + b + 2));
		},
		frozenRejects() {
			return frozenRejectsUnseen();
		},
		thenThrows() {
			return {
				then() {
					throw new Error("then threw");
				}
			};
		},
		laterResolves() {
			return later(false);
		},
		laterRejects() {
			return later(true);
		},
		dropsToNative() {
			return {
				then(onFulfilled) {
					return Promise.reject(new Error("unseen")).then(onFulfilled);
				}
			};
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

		it.each([
			[
				"calls back later from a timer and returns nothing",
				() => ({
					then(resolve) {
						setTimeout(() => resolve("minimal"), 1);
					}
				}),
				{ ok: true, value: "minimal" }
			],
			[
				"takes only onFulfilled and rejects through the promise it returns",
				() => ({
					then(onFulfilled) {
						return new Promise((resolve, reject) => {
							try {
								resolve(
									onFulfilled(
										(() => {
											throw new Error("query failed");
										})()
									)
								);
							} catch (error) {
								reject(error);
							}
						});
					}
				}),
				{ ok: false, message: "query failed" }
			],
			[
				"throws from then synchronously",
				() => ({
					then() {
						throw new Error("then threw");
					}
				}),
				{ ok: false, message: "then threw" }
			]
		])("a hand-written thenable that %s settles the call as awaiting it would", async (_label, make, expected) => {
			api = await boot(config);
			const errors = [];
			const always = [];
			api.slothlet.hook.on("svc.mulThenable:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
			api.slothlet.hook.on("svc.mulThenable:always", ({ hasError }) => always.push(hasError), { id: "always" });
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) => {
					next();
					return make();
				},
				{ id: "hand" }
			);

			let returned;
			expect(() => (returned = api.svc.mulThenable(2, 3))).not.toThrow();
			expect(typeof returned?.then).toBe("function");
			const result = await outcome(() => returned);
			if (expected.ok) {
				expect(result).toEqual({ ok: true, value: expected.value });
				expect(errors).toEqual([]);
			} else {
				expect(result.ok).toBe(false);
				expect(result.error.message).toBe(expected.message);
				expect(errors).toEqual([`${expected.message}:around`]);
			}
			expect(always).toEqual([!expected.ok]);
		});

		it("a hand-written thenable that calls its rejection callback later from a timer rejects the call without a throw at its call site", async () => {
			api = await boot(config);
			const errors = [];
			const always = [];
			const uncaught = [];
			const onUncaught = (error) => uncaught.push(error);
			process.on("uncaughtException", onUncaught);
			api.slothlet.hook.on(
				"svc.mulThenable:error",
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId}`),
				{ id: "er" }
			);
			api.slothlet.hook.on("svc.mulThenable:always", ({ hasError }) => always.push(hasError), { id: "always" });
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) => {
					next();
					return {
						then(_resolve, reject) {
							setTimeout(() => {
								try {
									reject(new Error("timer reject"));
								} catch (error) {
									uncaught.push(error);
								}
							}, 1);
						}
					};
				},
				{ id: "timer" }
			);

			try {
				const result = await outcome(() => api.svc.mulThenable(2, 3));
				await new Promise((resolve) => setTimeout(resolve, 5));
				expect(uncaught).toEqual([]);
				expect(result.ok).toBe(false);
				expect(result.error.message).toBe("timer reject");
				expect(errors).toEqual(["timer reject:around:timer"]);
				expect(always).toEqual([true]);
			} finally {
				process.off("uncaughtException", onUncaught);
			}
		});

		it("a hand-written thenable whose then calls its rejection callback synchronously leaves no unhandled rejection", async () => {
			api = await boot(config);
			const errors = [];
			const unhandled = [];
			const onUnhandled = (reason) => unhandled.push(reason);
			process.on("unhandledRejection", onUnhandled);
			api.slothlet.hook.on("svc.mulThenable:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) => {
					next();
					return {
						then(_resolve, reject) {
							reject(new Error("sync reject"));
						}
					};
				},
				{ id: "sync-reject" }
			);

			try {
				const result = await outcome(() => api.svc.mulThenable(2, 3));
				await new Promise((resolve) => setTimeout(resolve, 5));
				await new Promise((resolve) => setImmediate(resolve));
				expect(unhandled).toEqual([]);
				expect(result.ok).toBe(false);
				expect(result.error.message).toBe("sync reject");
				expect(errors).toEqual(["sync reject:around"]);
			} finally {
				process.off("unhandledRejection", onUnhandled);
			}
		});

		it("a target's NaN rejection through a derived thenable keeps the function source", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on("svc.rejectNaN:error", ({ error, source }) => errors.push({ error, type: source.type }), { id: "er" });
			api.slothlet.hook.on("svc.rejectNaN:around", ({ next }) => next().then((value) => value), { id: "derived" });

			const result = await outcome(() => api.svc.rejectNaN());
			expect(result.ok).toBe(false);
			expect(result.error).toBeNaN();
			expect(errors).toHaveLength(1);
			expect(errors[0].error).toBeNaN();
			expect(errors[0].type).toBe("function");
		});

		it("a rejection the observer could not see is reported as that hook's around failure", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on(
				"svc.mulThenable:error",
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId}`),
				{ id: "er" }
			);
			// Its `then` drops the rejection callback and returns its own kind, which rejects on its own.
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) => {
					next();
					return {
						then(onFulfilled) {
							return new MyThen(Promise.reject(new Error("unseen")).then(onFulfilled));
						}
					};
				},
				{ id: "unseen" }
			);

			const result = await outcome(() => api.svc.mulThenable(2, 3));
			expect(result.ok).toBe(false);
			expect(result.error.message).toBe("unseen");
			expect(errors).toEqual(["unseen:around:unseen"]);
		});

		it.each([
			[
				"fulfils and then throws",
				() => ({
					then(onFulfilled) {
						onFulfilled(1);
						throw new Error("after fulfil");
					}
				}),
				{ ok: true, value: 1 }
			],
			[
				"rejects and then throws another error",
				() => ({
					then(_onFulfilled, onRejected) {
						onRejected(new Error("first"));
						throw new Error("second");
					}
				}),
				{ ok: false, message: "first" }
			],
			[
				"rejects twice",
				() => ({
					then(_onFulfilled, onRejected) {
						onRejected(new Error("first"));
						onRejected(new Error("second"));
					}
				}),
				{ ok: false, message: "first" }
			]
		])("a hand-written thenable whose then %s settles once, as awaiting it would", async (_label, make, expected) => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on("svc.mulThenable:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) => {
					next();
					return make();
				},
				{ id: "hand" }
			);

			const result = await outcome(() => api.svc.mulThenable(2, 3));
			if (expected.ok) {
				expect(result).toEqual({ ok: true, value: expected.value });
				expect(errors).toEqual([]);
			} else {
				expect(result.ok).toBe(false);
				expect(result.error.message).toBe(expected.message);
				expect(errors).toEqual([`${expected.message}:around`]);
			}
		});

		it("an unseen rejection from an inner hook's thenable an outer hook passes through is reported as the inner hook's", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on(
				"svc.mulThenable:error",
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId}`),
				{ id: "er" }
			);
			api.slothlet.hook.on("svc.mulThenable:around", ({ next }) => next(), { id: "outer", priority: 10 });
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) => {
					next();
					return {
						then(onFulfilled) {
							return new MyThen(Promise.reject(new Error("unseen")).then(onFulfilled));
						}
					};
				},
				{ id: "inner", priority: 1 }
			);

			const result = await outcome(() => api.svc.mulThenable(2, 3));
			expect(result.ok).toBe(false);
			expect(result.error.message).toBe("unseen");
			expect(errors).toEqual(["unseen:around:inner"]);
		});

		it.each([
			[
				"an inner hook returns a harmless one of its own kind and the outer hook's rejects unseen",
				{ outer: () => rejectsUnseen(), inner: (next) => new MyThen(Promise.resolve(next())) },
				"unseen:around:outer"
			],
			[
				"the outer hook derives from the inner hook's, which rejects unseen",
				{ outer: (next) => next().then((value) => value), inner: () => rejectsUnseen() },
				"unseen:around:inner"
			],
			[
				"both pass the target's own through, and the target's rejects unseen",
				{ outer: (next) => next(), inner: (next) => next(), target: "dropsRejection" },
				"unseen:function:"
			]
		])("a rejection no callback saw is reported as the stage whose thenable produced it: %s", async (_label, shape, expected) => {
			api = await boot(config);
			const target = shape.target ?? "mulThenable";
			const errors = [];
			api.slothlet.hook.on(
				`svc.${target}:error`,
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId ?? ""}`),
				{ id: "er" }
			);
			for (const [id, priority] of [
				["outer", 10],
				["inner", 1]
			]) {
				api.slothlet.hook.on(
					`svc.${target}:around`,
					({ next }) => {
						// A shape that takes no `next` leaves calling it to here, as a handler replacing the result would.
						if (!shape[id].length) next();
						return shape[id](next);
					},
					{ id, priority }
				);
			}

			const result = await outcome(() => api.svc[target](2, 3));
			expect(result.ok).toBe(false);
			expect(result.error.message).toBe("unseen");
			expect(errors).toEqual([expected]);
		});

		it("a target thenable whose then returns a native Promise without calling the rejection callback reports a function failure", async () => {
			api = await boot(config);
			const errors = [];
			const always = [];
			api.slothlet.hook.on("svc.dropsToNative:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
			api.slothlet.hook.on("svc.dropsToNative:always", ({ hasError }) => always.push(hasError), { id: "always" });
			api.slothlet.hook.on("svc.dropsToNative:around", ({ next }) => next(), { id: "pass" });

			const result = await outcome(() => api.svc.dropsToNative());
			expect(result.ok).toBe(false);
			expect(result.error.message).toBe("unseen");
			expect(errors).toEqual(["unseen:function"]);
			expect(always).toEqual([true]);
		});

		it.each([
			["the target returns it and the hook passes it through", "frozenThenable", (next) => next(), { ok: true, value: 7 }],
			[
				"the hook returns it after next()",
				"mulThenable",
				(next) => frozen(Promise.resolve(next()).then((value) => value + 1)),
				{ ok: true, value: 7 }
			],
			["the target's rejects unseen", "frozenRejects", (next) => next(), { ok: false, error: "unseen:function:" }],
			[
				"the hook's rejects unseen",
				"mulThenable",
				(next) => {
					next();
					return frozenRejectsUnseen();
				},
				{ ok: false, error: "unseen:around:hand" }
			]
		])("a frozen thenable settles the call as awaiting it would: %s", async (_label, target, handler, expected) => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on(
				`svc.${target}:error`,
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId ?? ""}`),
				{ id: "er" }
			);
			api.slothlet.hook.on(`svc.${target}:around`, ({ next }) => handler(next), { id: "hand" });

			const result = await outcome(() => api.svc[target](3, 2));
			if (expected.ok) {
				expect(result).toEqual({ ok: true, value: expected.value });
				expect(errors).toEqual([]);
			} else {
				expect(result.ok).toBe(false);
				expect(result.error.message).toBe("unseen");
				expect(errors).toEqual([expected.error]);
			}
		});

		it("a target thenable whose then throws synchronously reports a function failure", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on("svc.thenThrows:error", ({ error, source }) => errors.push(`${error.message}:${source.type}`), { id: "er" });
			api.slothlet.hook.on("svc.thenThrows:around", ({ next }) => next(), { id: "pass" });

			const result = await outcome(() => api.svc.thenThrows());
			expect(result.ok).toBe(false);
			expect(result.error.message).toBe("then threw");
			expect(errors).toEqual(["then threw:function"]);
		});

		it("a stage's thenable of its own kind keeps its methods and kind when its rejections are recorded", async () => {
			api = await boot(config);
			api.slothlet.hook.on("svc.customThenable:around", ({ next }) => next().then((value) => value * 2), { id: "derived" });

			const result = api.svc.customThenable(4);
			expect(result).toBeInstanceOf(MyThen);
			expect(result.cancel).toBe(result.cancel);
			expect(result.cancel()).toBe("cancelled");
			expect(await result).toBe(8);
		});

		it("a rejection of an unrelated thenable returned after next() is reported as that hook's around failure", async () => {
			api = await boot(config);
			const errors = [];
			api.slothlet.hook.on(
				"svc.mulThenable:error",
				({ error, source }) => errors.push(`${error.message}:${source.type}:${source.hookId}`),
				{ id: "er" }
			);
			api.slothlet.hook.on(
				"svc.mulThenable:around",
				({ next }) => {
					next();
					return Promise.reject(new Error("unrelated"));
				},
				{ id: "unrelated" }
			);

			const result = await outcome(() => api.svc.mulThenable(2, 3));
			expect(result.ok).toBe(false);
			expect(errors).toEqual(["unrelated:around:unrelated"]);
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

		it.each([
			["an around hook passing next() through", "around"],
			["only a before hook", "before"]
		])("a target thenable that settles from a timer and returns nothing from then settles the call: %s", async (_label, kind) => {
			api = await boot(config);
			const errors = [];
			const uncaught = [];
			const onUncaught = (error) => uncaught.push(error);
			process.on("uncaughtException", onUncaught);
			for (const target of ["laterResolves", "laterRejects"]) {
				api.slothlet.hook.on(`svc.${target}:error`, ({ error, source }) => errors.push(`${error.message}:${source.type}`), {
					id: `er-${target}`
				});
				if (kind === "around") api.slothlet.hook.on(`svc.${target}:around`, ({ next }) => next(), { id: `pass-${target}` });
				else api.slothlet.hook.on(`svc.${target}:before`, () => {}, { id: `before-${target}` });
			}

			try {
				const resolved = await outcome(() => api.svc.laterResolves());
				const rejected = await outcome(() => api.svc.laterRejects());
				await new Promise((resolve) => setTimeout(resolve, 5));
				expect(uncaught).toEqual([]);
				expect(resolved).toEqual({ ok: true, value: "late value" });
				expect(rejected.ok).toBe(false);
				expect(rejected.error.message).toBe("late");
				expect(errors).toEqual(["late:function"]);
			} finally {
				process.off("uncaughtException", onUncaught);
			}
		});
	}
);
