/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-around.test.vitest.mjs
 *	@Date: 2026-09-28T12:00:00-07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:07-07:00 (1791090907)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `around` hook type (#496): pipeline shape, args/result transforms, short-circuit,
 * error flow, priority nesting, caller/entry context, `next()` misuse and hook management.
 *
 * @description
 * `hook.on("<pattern>:around", ({ path, args, next, caller, entry }) => next(args))` wraps the rest of
 * the pipeline. Order, outermost first: `always`/`error` observers → around hooks (highest priority
 * outermost) → before hooks → the function → after hooks. Because the observers sit outside the
 * around chain they see what the caller receives: an error an around rethrows reaches the error
 * hooks, one it swallows does not, and `always` fires once after the chain settles.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

// Minimal boot base; targets are mounted inline per test.
const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/** The api the inline targets call back into for nested calls; set by boot(). */
let current = null;

/** Probe log shared by the targets and the hooks of one test. */
const log = [];

const TARGETS = {
	exports: {
		/**
		 * Synchronous target that records its own execution.
		 * @param {number} a - Left operand.
		 * @param {number} b - Right operand.
		 * @returns {number} Product.
		 */
		mul(a, b) {
			log.push(`fn(${a},${b})`);
			return a * b;
		},
		/**
		 * Target that always throws.
		 * @param {string} message - Error message.
		 * @returns {never} Never returns.
		 */
		fail(message) {
			log.push("fn-fail");
			throw new Error(message);
		},
		/**
		 * Makes a nested wrapper-to-wrapper call.
		 * @param {number} a - Operand.
		 * @returns {number} `svc.mul(a, 2)`.
		 */
		outer(a) {
			log.push("fn-outer");
			return current.svc.mul(a, 2);
		}
	}
};

/**
 * Boots an api with hooks enabled over the shared base and mounts the targets.
 * @param {object} config - Matrix configuration for this run.
 * @param {object} [hook={}] - Extra hook config.
 * @returns {Promise<object>} The bound api.
 */
async function boot(config, hook = {}) {
	log.length = 0;
	const api = await slothlet({ ...config, base: BASE, hook: { enabled: true, ...hook } });
	await api.slothlet.api.add("svc", TARGETS);
	current = api;
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

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hooks > around (#496) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		current = null;
	});

	it("wraps before → function → after, with always outside the around", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mul:always", () => log.push("always"), { id: "al" });
		// Block bodies: a before hook returning a non-array value would short-circuit, and an after
		// hook returning one would replace the result.
		api.slothlet.hook.on(
			"svc.mul:before",
			() => {
				log.push("before");
			},
			{ id: "be" }
		);
		api.slothlet.hook.on(
			"svc.mul:after",
			() => {
				log.push("after");
			},
			{ id: "af" }
		);
		api.slothlet.hook.on(
			"svc.mul:around",
			({ next }) => {
				log.push("around-in");
				const result = next();
				log.push("around-out");
				return result;
			},
			{ id: "ar" }
		);

		expect(await api.svc.mul(2, 3)).toBe(6);
		expect(log).toEqual(["around-in", "before", "fn(2,3)", "after", "around-out", "always"]);
	});

	it("receives path and args, and next(args) replaces the args for the rest of the pipeline", async () => {
		api = await boot(config);
		const seen = [];
		api.slothlet.hook.on(
			"svc.mul:around",
			({ path, args, next }) => {
				seen.push({ path, args });
				return next([args[0] + 1, args[1]]);
			},
			{ id: "ar" }
		);
		api.slothlet.hook.on(
			"svc.mul:before",
			({ args }) => {
				seen.push({ before: args });
			},
			{ id: "be" }
		);

		expect(await api.svc.mul(2, 3)).toBe(9);
		expect(seen).toEqual([{ path: "svc.mul", args: [2, 3] }, { before: [3, 3] }]);
	});

	it("next() with no argument forwards the current args", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mul:around", ({ next }) => next([10, 2]), { id: "outer", priority: 10 });
		api.slothlet.hook.on("svc.mul:around", ({ next }) => next(), { id: "inner", priority: 1 });

		expect(await api.svc.mul(2, 3)).toBe(20);
		expect(log).toEqual(["fn(10,2)"]);
	});

	it("transforms the result — after hooks have already run inside next()", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mul:after", ({ result }) => result + 1, { id: "af" });
		api.slothlet.hook.on("svc.mul:around", ({ next }) => next() * 10, { id: "ar" });

		// (2*3 + 1) * 10
		expect(await api.svc.mul(2, 3)).toBe(70);
	});

	it("short-circuits when next is never called: its return value is the result", async () => {
		api = await boot(config);
		const always = [];
		api.slothlet.hook.on("svc.mul:before", () => log.push("before"), { id: "be" });
		api.slothlet.hook.on("svc.mul:after", () => log.push("after"), { id: "af" });
		api.slothlet.hook.on("svc.mul:always", ({ result, hasError }) => always.push({ result, hasError }), { id: "al" });
		api.slothlet.hook.on("svc.mul:around", () => "cached", { id: "ar" });

		expect(await api.svc.mul(2, 3)).toBe("cached");
		expect(log, "before, function and after never ran").toEqual([]);
		expect(always).toEqual([{ result: "cached", hasError: false }]);
	});

	it("an around that swallows the function's error hides it from error hooks", async () => {
		api = await boot(config);
		const errors = [];
		const always = [];
		api.slothlet.hook.on("svc.fail:error", ({ error }) => errors.push(error.message), { id: "er" });
		api.slothlet.hook.on("svc.fail:always", ({ result, hasError }) => always.push({ result, hasError }), { id: "al" });
		api.slothlet.hook.on(
			"svc.fail:around",
			({ next }) => {
				try {
					return next();
				} catch (error) {
					return `recovered:${error.message}`;
				}
			},
			{ id: "ar" }
		);

		expect(await api.svc.fail("boom")).toBe("recovered:boom");
		expect(errors, "the caller never saw an error, so neither do error hooks").toEqual([]);
		expect(always).toEqual([{ result: "recovered:boom", hasError: false }]);
	});

	it("an error rethrown after a rollback reaches error hooks once, with its original source", async () => {
		api = await boot(config);
		const errors = [];
		const always = [];
		api.slothlet.hook.on("svc.fail:error", ({ error, source }) => errors.push({ message: error.message, type: source.type }), { id: "er" });
		api.slothlet.hook.on("svc.fail:always", ({ hasError, errors: errs }) => always.push({ hasError, count: errs.length }), { id: "al" });
		api.slothlet.hook.on(
			"svc.fail:around",
			({ next }) => {
				try {
					return next();
				} catch (error) {
					log.push("rollback");
					throw error;
				}
			},
			{ id: "ar" }
		);

		const result = await outcome(() => api.svc.fail("boom"));
		expect(result.ok).toBe(false);
		expect(result.error.message).toBe("boom");
		expect(log).toEqual(["fn-fail", "rollback"]);
		expect(errors).toEqual([{ message: "boom", type: "function" }]);
		expect(always).toEqual([{ hasError: true, count: 1 }]);
	});

	it("an around hook's own error is reported with an `around` source", async () => {
		api = await boot(config);
		const sources = [];
		api.slothlet.hook.on("svc.mul:error", ({ source }) => sources.push(source), { id: "er" });
		api.slothlet.hook.on(
			"svc.mul:around",
			() => {
				throw new Error("denied");
			},
			{ id: "gate", subset: "before" }
		);

		const result = await outcome(() => api.svc.mul(1, 2));
		expect(result.error.message).toBe("denied");
		expect(sources).toHaveLength(1);
		expect(sources[0]).toMatchObject({ type: "around", hookId: "gate", hookTag: "gate", subset: "before" });
		expect(typeof sources[0].timestamp).toBe("number");
		expect(log, "target never ran").toEqual([]);
	});

	it("a before hook's error propagates through next() to the around hook", async () => {
		api = await boot(config);
		const sources = [];
		const caught = [];
		api.slothlet.hook.on("svc.mul:error", ({ source }) => sources.push(source.type), { id: "er" });
		api.slothlet.hook.on(
			"svc.mul:before",
			() => {
				throw new Error("invalid");
			},
			{ id: "be" }
		);
		api.slothlet.hook.on(
			"svc.mul:around",
			({ next }) => {
				try {
					return next();
				} catch (error) {
					caught.push(error.message);
					throw error;
				}
			},
			{ id: "ar" }
		);

		const result = await outcome(() => api.svc.mul(1, 2));
		expect(result.error.message).toBe("invalid");
		expect(caught).toEqual(["invalid"]);
		expect(sources).toEqual(["before"]);
	});

	it("an after hook's error propagates through next() and is reported with an `after` source", async () => {
		api = await boot(config);
		const sources = [];
		const caught = [];
		api.slothlet.hook.on("svc.mul:error", ({ source }) => sources.push({ type: source.type, hookId: source.hookId }), { id: "er" });
		api.slothlet.hook.on(
			"svc.mul:after",
			() => {
				throw new Error("post");
			},
			{ id: "af" }
		);
		api.slothlet.hook.on(
			"svc.mul:around",
			({ next }) => {
				try {
					return next();
				} catch (error) {
					caught.push(error.message);
					throw error;
				}
			},
			{ id: "ar" }
		);

		const result = await outcome(() => api.svc.mul(1, 2));
		expect(result.error.message).toBe("post");
		expect(caught).toEqual(["post"]);
		expect(sources).toEqual([{ type: "after", hookId: "af" }]);
	});

	it("suppressErrors applies to what escapes the around chain", async () => {
		api = await boot(config, { suppressErrors: true });
		const errors = [];
		api.slothlet.hook.on("svc.fail:error", ({ error }) => errors.push(error.message), { id: "er" });
		api.slothlet.hook.on("svc.fail:around", ({ next }) => next(), { id: "ar" });

		expect(await api.svc.fail("quiet")).toBeUndefined();
		expect(errors).toEqual(["quiet"]);
	});

	it("always fires exactly once per call, after the around chain settles", async () => {
		api = await boot(config);
		let alwaysCount = 0;
		api.slothlet.hook.on(
			"svc.mul:always",
			() => {
				alwaysCount++;
				log.push("always");
			},
			{ id: "al" }
		);
		api.slothlet.hook.on("svc.mul:around", ({ next }) => (log.push("outer"), next()), { id: "a1", priority: 2 });
		api.slothlet.hook.on("svc.mul:around", ({ next }) => (log.push("inner"), next()), { id: "a2", priority: 1 });

		await api.svc.mul(1, 1);
		expect(alwaysCount).toBe(1);
		expect(log.at(-1)).toBe("always");
	});

	it("nests multiple around hooks by priority — highest outermost, subsets ordered first", async () => {
		api = await boot(config);
		const wrap =
			(name) =>
			({ next }) => {
				log.push(`${name}>`);
				const value = next();
				log.push(`<${name}`);
				return value;
			};
		api.slothlet.hook.on("svc.mul:around", wrap("low"), { id: "low", priority: 1 });
		api.slothlet.hook.on("svc.mul:around", wrap("high"), { id: "high", priority: 100 });
		api.slothlet.hook.on("svc.mul:around", wrap("auth"), { id: "auth", subset: "before", priority: 0 });
		api.slothlet.hook.on("svc.mul:around", wrap("audit"), { id: "audit", subset: "after", priority: 1000 });

		expect(await api.svc.mul(2, 2)).toBe(4);
		expect(log).toEqual(["auth>", "high>", "low>", "audit>", "fn(2,2)", "<audit", "<low", "<high", "<auth"]);
	});

	it("reports entry/caller: an outside call is an entry, a nested call carries its caller", async () => {
		api = await boot(config);
		const seen = [];
		api.slothlet.hook.on(
			"svc.**:around",
			({ path, entry, caller, next }) => {
				seen.push({ path, entry, caller: caller ? caller.apiPath : caller });
				return next();
			},
			{ id: "ar" }
		);

		expect(await api.svc.outer(5)).toBe(10);
		expect(seen).toEqual([
			{ path: "svc.outer", entry: true, caller: null },
			{ path: "svc.mul", entry: false, caller: "svc.outer" }
		]);
	});

	it("scopes next() to its own call: a nested call's args change does not leak outward", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mul:around", ({ args, next }) => next([args[0], 100]), { id: "nested" });
		api.slothlet.hook.on("svc.outer:around", ({ next }) => next() + 1, { id: "outer" });

		// outer(5) → mul(5, 2) rewritten to mul(5, 100) = 500, then the outer around adds 1.
		expect(await api.svc.outer(5)).toBe(501);
		expect(log).toEqual(["fn-outer", "fn(5,100)"]);
	});

	it("calling next() twice throws HOOK_AROUND_NEXT_CALLED_TWICE (reported as an around failure)", async () => {
		api = await boot(config);
		const sources = [];
		api.slothlet.hook.on("svc.mul:error", ({ error, source }) => sources.push({ code: error.code, type: source.type }), { id: "er" });
		api.slothlet.hook.on(
			"svc.mul:around",
			({ next }) => {
				next();
				return next();
			},
			{ id: "twice" }
		);

		const result = await outcome(() => api.svc.mul(2, 3));
		expect(result.ok).toBe(false);
		expect(result.error.code).toBe("HOOK_AROUND_NEXT_CALLED_TWICE");
		expect(result.error.message).toContain("svc.mul");
		expect(log, "the target ran exactly once").toEqual(["fn(2,3)"]);
		expect(sources).toEqual([{ code: "HOOK_AROUND_NEXT_CALLED_TWICE", type: "around" }]);
	});

	it("next() with a non-array argument throws HOOK_AROUND_NEXT_INVALID_ARGS", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mul:around", ({ next }) => next(5), { id: "bad" });

		const result = await outcome(() => api.svc.mul(2, 3));
		expect(result.error.code).toBe("HOOK_AROUND_NEXT_INVALID_ARGS");
		expect(log).toEqual([]);
	});

	it("is managed like any other hook type: list, disable/enable, remove", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.mul:around", ({ next }) => next() * 2, { id: "double" });

		const { registeredHooks } = api.slothlet.hook.list({ type: "around" });
		expect(registeredHooks).toEqual([expect.objectContaining({ id: "double", type: "around", pattern: "svc.mul", subset: "primary" })]);
		expect(api.slothlet.hook.list("around").registeredHooks).toHaveLength(1);
		expect(await api.svc.mul(2, 3)).toBe(12);

		api.slothlet.hook.disable({ id: "double" });
		expect(await api.svc.mul(2, 3)).toBe(6);
		api.slothlet.hook.enable({ id: "double" });
		expect(await api.svc.mul(2, 3)).toBe(12);

		expect(api.slothlet.hook.remove({ type: "around" })).toBe(1);
		expect(await api.svc.mul(2, 3)).toBe(6);
		expect(api.slothlet.hook.list({ type: "around" }).registeredHooks).toEqual([]);
	});

	it("honours the global path filter", async () => {
		api = await boot(config);
		api.slothlet.hook.on("svc.**:around", ({ next }) => next() * 2, { id: "double" });
		expect(await api.svc.mul(2, 3)).toBe(12);

		api.slothlet.hook.enablePattern("other.**");
		expect(await api.svc.mul(2, 3), "path excluded by the filter").toBe(6);

		api.slothlet.hook.resetPatternFilter();
		expect(await api.svc.mul(2, 3)).toBe(12);
	});
});

describe("Hooks > around (#496) > versioned registration", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("resolves through the version dispatcher and fires with the version in context", async () => {
		api = await slothlet({ mode: "eager", base: BASE, hook: { enabled: true } });
		for (const version of ["v1", "v2"]) {
			await api.slothlet.api.add(
				"auth",
				{
					exports: {
						/**
						 * Versioned leaf.
						 * @returns {string} Identifier.
						 */
						login() {
							return `login-${version}`;
						}
					}
				},
				{},
				{ version, default: version === "v1" }
			);
		}
		const fired = [];
		const id = api.slothlet.hook.on(
			"auth.login:around",
			({ version, path, next }) => {
				fired.push({ version, path });
				return `${next()}!`;
			},
			{ id: "audit", versionDispatcher: () => ["v1", "v2"] }
		);

		expect(api.v1.auth.login()).toBe("login-v1!");
		expect(api.v2.auth.login()).toBe("login-v2!");
		expect(fired).toEqual([
			{ version: "v1", path: "v1.auth.login" },
			{ version: "v2", path: "v2.auth.login" }
		]);

		expect(api.slothlet.hook.remove({ id })).toBe(2);
		expect(api.v1.auth.login()).toBe("login-v1");
	});
});
