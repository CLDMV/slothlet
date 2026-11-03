/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-sync-leaf-thenable.test.vitest.mjs
 *	@Date: 2026-11-03T04:50:56-08:00 (1793710256)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T06:32:22-08:00 (1793716342)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #599 — code a synchronous leaf hands back runs as that leaf's module, not as the caller awaiting it.
 *
 * @description
 * A plain (not `async`) leaf can return a value whose code runs after the leaf has returned: a hand-written
 * thenable's `then`, a Proxy's traps, or the `message` / `name` accessors of an Error it throws or rejects with,
 * which the engine reads when it formats the error's `stack`. That code is the leaf's module's, so every `self.*`
 * call it makes has to be checked against that module's rules, even though it runs while the caller is awaiting
 * the result and while slothlet reports the failure to error hooks.
 *
 * Fixture: only `a` may call `c.vault.secret`; `c.vault.whoami` is open to everyone and reports its caller. `a`
 * awaits `b.give`'s leaves, whose code calls the vault. `d.maker.make` is a second synchronous leaf `b` hands on.
 *
 * Every case runs across the matrix (eager/lazy, async/live, hooks on/off), and the error cases also through each
 * hook pipeline: none registered, an error hook, a synchronous around hook, and an async before hook (which moves
 * the call onto the asynchronous pipeline). An error's accessor may be refused for more than one reason (no
 * module context at all is refused too), so those cases assert only that it never gets `a`'s rights or name.
 *
 * @module tests/vitests/suites/permissions/permissions-sync-leaf-thenable
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_SYNC_LEAF_THENABLE;

/** Deny by default; the vault's secret is `a`'s alone. */
const RULES = [
	{ caller: "a.**", target: "c.vault.secret", effect: "allow" },
	{ caller: "**", target: "c.vault.whoami", effect: "allow" },
	{ caller: "a.**", target: "b.**", effect: "allow" },
	{ caller: "b.**", target: "d.**", effect: "allow" }
];

/** The same tree with the secret allowed to `b` instead, for the reverse case (#597). */
const RULES_B = [
	{ caller: "b.**", target: "c.vault.secret", effect: "allow" },
	{ caller: "**", target: "c.vault.whoami", effect: "allow" },
	{ caller: "a.**", target: "b.**", effect: "allow" }
];

const DENIED = { ok: false, code: "PERMISSION_DENIED" };

/**
 * Leaves of `b.give` returning a thenable whose code calls the vault.
 * @type {Array<[string, string]>}
 */
const THENABLES = [
	["syncThen", "then() calls the vault synchronously (the issue's repro)"],
	["timerThen", "then() calls the vault from a timer"],
	["microtaskThen", "then() calls the vault from a queued microtask"],
	["asyncLeaf", "the same thenable from an async leaf"]
];

/**
 * Ways a leaf fails with an Error carrying an accessor: [how, inherited, prop].
 * @type {Array<["throw"|"reject"|"thenable", boolean, "message"|"name"]>}
 */
const FAILURES = ["throw", "reject", "thenable"].flatMap((how) =>
	[false, true].flatMap((inherited) => ["message", "name"].map((prop) => [how, inherited, prop]))
);

/**
 * Hook setups the error cases run under.
 * @type {Record<string, function(object): void>}
 */
const PIPELINES = {
	"no hook": () => {},
	"an error hook": (api) => api.slothlet.hook.on("b.**:error", () => {}, { id: "i599-error" }),
	"an around hook": (api) => api.slothlet.hook.on("b.**:around", ({ next }) => next(), { id: "i599-around" }),
	"an async before hook": (api) => api.slothlet.hook.on("b.**:before", async () => {}, { id: "i599-before" })
};

/**
 * Describe a failure case for a test title.
 * @param {string} how - How the leaf fails.
 * @param {boolean} inherited - Whether the accessor is inherited.
 * @param {string} prop - Which property is the accessor.
 * @returns {string} The label.
 */
const failureLabel = (how, inherited, prop) => `${how}, ${inherited ? "inherited" : "own"} ${prop} getter`;

describe.each(getMatrixConfigs())("Permissions > sync leaf thenable (#599) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the fixture api under the deny-by-default rules.
	 * @param {object} [permissions] - Overrides for the permissions config.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (permissions = {}) => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: RULES, ...permissions } });
		return api;
	};

	// ── Controls ────────────────────────────────────────────────────────────────

	it("control: a may call the vault's secret", async () => {
		await build();
		expect(await api.a.use.direct()).toBe("s3cret");
	});

	it("control: the vault sees a on a direct call", async () => {
		await build();
		expect(await api.a.use.direct("whoami")).toBe("a.use.direct");
	});

	// ── A thenable's then() runs as the module that returned it ─────────────────

	it.each(THENABLES)("%s: refused, although a awaits it — %s", async (leaf) => {
		await build();
		expect(await api.a.use.give(leaf, "secret")).toEqual(DENIED);
	});

	it.each(THENABLES)("%s: the vault sees b, not a — %s", async (leaf) => {
		await build();
		expect(await api.a.use.give(leaf, "whoami")).toEqual({ ok: true, value: `b.give.${leaf}` });
	});

	it("a thenable whose then is a getter: the getter and the function it returns both run as b", async () => {
		await build();
		expect(await api.a.use.give("getterThen", "secret")).toEqual({ getter: DENIED, then: DENIED });
		expect(await api.a.use.give("getterThen", "whoami")).toEqual({
			getter: { ok: true, value: "b.give.getterThen" },
			then: { ok: true, value: "b.give.getterThen" }
		});
	});

	it("a thenable another module's synchronous leaf returned, handed on by b, runs as that module", async () => {
		await build();
		expect(await api.a.use.give("nested", "secret")).toEqual(DENIED);
		expect(await api.a.use.give("nested", "whoami")).toEqual({ ok: true, value: "d.maker.make" });
	});

	it("a Proxy result: every trap the await runs is b's", async () => {
		await build();
		await api.a.use.give("proxy", "secret");
		const refused = await api.b.give.drain();
		expect(refused.length).toBeGreaterThan(0);
		expect(refused).toEqual(refused.map(() => DENIED));
		await api.a.use.give("proxy", "whoami");
		const seen = await api.b.give.drain();
		expect(seen).toEqual(seen.map(() => ({ ok: true, value: "b.give.proxy" })));
	});

	// ── Resolution matches plain JS for a permitted caller ──────────────────────

	it("a native Promise result is handed back as a Promise and resolves to its value", async () => {
		await build();
		const result = api.b.give.native(7);
		expect(result).toBeInstanceOf(Promise);
		expect(await result).toBe(7);
		expect(await api.a.use.give("native", 8)).toBe(8);
	});

	it("a thenable resolving to a value resolves to it", async () => {
		await build();
		expect(await api.a.use.give("value", 2)).toBe(2);
	});

	it("a thenable that rejects rejects with its reason", async () => {
		await build();
		const reason = new Error("rejected");
		await expect(api.a.use.give("rejects", reason)).rejects.toBe(reason);
	});

	it("a thenable whose then throws rejects with what it threw", async () => {
		await build();
		const reason = new Error("thrown");
		await expect(api.a.use.give("throws", reason)).rejects.toBe(reason);
	});

	it("a thenable that resolves and then throws resolves: the first settlement wins", async () => {
		await build();
		expect(await api.a.use.give("resolvesThenThrows", 3)).toBe(3);
	});

	it("a thenable that never calls back stays pending", async () => {
		await build();
		const outcome = await Promise.race([
			api.a.use.give("never").then(() => "settled"),
			new Promise((resolve) => setTimeout(() => resolve("pending"), 25))
		]);
		expect(outcome).toBe("pending");
	});

	// ── The reverse case (#597) stays fixed ─────────────────────────────────────

	it("reverse (#597): a thenable a hands b runs as a", async () => {
		await build();
		expect(await api.a.use.supply("whoami")).toEqual({ ok: true, value: "a.use.supply" });
	});

	it("reverse (#597): a thenable a hands b does not get b's rights", async () => {
		await build({ rules: RULES_B });
		expect(await api.a.use.supply()).toEqual(DENIED);
	});

	// ── An Error's accessors run as the module that threw it ────────────────────

	describe.each(Object.entries(PIPELINES))("with %s", (_pipeline, register) => {
		/**
		 * Build the api and register the pipeline's hooks, when hooks are on.
		 * @param {object} [permissions] - Overrides for the permissions config.
		 * @returns {Promise<void>}
		 */
		const setup = async (permissions) => {
			await build(permissions);
			if (config.hook?.enabled) register(api);
		};

		it.each(FAILURES)("%s/%s/%s: what slothlet reads of the error runs as b, never as a", async (how, inherited, prop) => {
			await setup();
			const label = failureLabel(how, inherited, prop);
			expect(await api.a.use.fails("failWithGetter", "secret", how, inherited, prop)).toBe(true);
			expect(await api.b.give.drain(), label).not.toContainEqual(expect.objectContaining({ ok: true }));
			expect(await api.a.use.fails("failWithGetter", "whoami", how, inherited, prop)).toBe(true);
			for (const outcome of await api.b.give.drain()) {
				if (outcome.ok) expect(outcome.value, label).toMatch(/^b\.give\./);
			}
		});

		it.each(FAILURES)(
			"%s/%s/%s: with provenance off, what slothlet reads of the error still never runs as a",
			async (how, inherited, prop) => {
				await setup({ provenance: false });
				const label = failureLabel(how, inherited, prop);
				expect(await api.a.use.fails("failWithGetter", "secret", how, inherited, prop)).toBe(true);
				expect(await api.b.give.drain(), label).not.toContainEqual(expect.objectContaining({ ok: true }));
				expect(await api.a.use.fails("failWithGetter", "whoami", how, inherited, prop)).toBe(true);
				for (const outcome of await api.b.give.drain()) {
					if (outcome.ok) expect(outcome.value, label).toMatch(/^b\.give\./);
				}
			}
		);
	});
});

describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Permissions > sync leaf thenable (#599) > hooks > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("an after hook sees the value the thenable resolved to and can replace it", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: RULES } });
		const seen = [];
		api.slothlet.hook.on(
			"b.give.value:after",
			({ result }) => {
				seen.push(result);
				return result * 10;
			},
			{ id: "i599-after" }
		);
		expect(await api.a.use.give("value", 4)).toBe(40);
		expect(seen).toEqual([4]);
	});

	it("an around hook's next() hands back the thenable's settlement, and the caller gets its value", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: RULES } });
		const seen = [];
		api.slothlet.hook.on(
			"b.give.value:around",
			({ next }) => {
				const result = next();
				seen.push(typeof result?.then);
				return result;
			},
			{ id: "i599-around" }
		);
		expect(await api.a.use.give("value", 5)).toBe(5);
		expect(seen).toEqual(["function"]);
	});

	it("an error hook sees the target's error and stack, read as b", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: RULES } });
		const seen = [];
		api.slothlet.hook.on("b.give.failWithGetter:error", ({ error, source }) => seen.push({ error, stack: source?.stack }), {
			id: "i599-error"
		});
		expect(await api.a.use.fails("failWithGetter", "secret", "reject")).toBe(true);
		expect(seen).toHaveLength(1);
		expect(seen[0].error).toBeInstanceOf(Error);
		expect(typeof seen[0].stack).toBe("string");
		expect(await api.b.give.drain()).not.toContainEqual(expect.objectContaining({ ok: true }));
	});

	it("an around hook's next() rejects with the thenable's reason", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: RULES } });
		api.slothlet.hook.on("b.give.rejects:around", ({ next }) => next(), { id: "i599-around" });
		const reason = new Error("rejected");
		await expect(api.a.use.give("rejects", reason)).rejects.toBe(reason);
	});
});

/**
 * Errors carrying code of `b`'s in places slothlet looks when it reports a failure.
 * @type {Array<[string, string]>}
 */
const CARRIERS = [
	["processedGetter", "a getter and setter on the old processed-mark symbol"],
	["proxy", "a Proxy error, every trap recorded"],
	["constructorGetter", "an own constructor getter"],
	["staticName", "a static name getter on the error's class"],
	["forgedMark", "a hand-set processed mark with a name getter behind it"]
];

/** How each carrier fails. @type {Array<string>} */
const HOWS = ["throw", "reject", "thenable"];

describe.each(getMatrixConfigs())("Permissions > sync leaf thenable (#599) > examining a failure > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	describe.each(Object.entries(PIPELINES))("with %s", (_pipeline, register) => {
		/**
		 * Build the api and register the pipeline's hooks, when hooks are on.
		 * @returns {Promise<void>}
		 */
		const setup = async () => {
			api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: RULES } });
			if (config.hook?.enabled) register(api);
		};

		describe.each(CARRIERS)("%s (%s)", (kind) => {
			it.each(HOWS)("%s: whatever slothlet runs of it never runs as a", async (how) => {
				await setup();
				const label = `${kind}, ${how}`;
				expect(await api.a.use.fails("failWith", kind, "secret", how)).toBe(true);
				expect(await api.b.give.drain(), label).not.toContainEqual(expect.objectContaining({ ok: true }));
				expect(await api.a.use.fails("failWith", kind, "whoami", how)).toBe(true);
				for (const outcome of await api.b.give.drain()) {
					if (outcome.ok) expect(outcome.value, label).toMatch(/^b\.give\./);
				}
			});
		});
	});
});

describe.each(getMatrixConfigs({ hook: { enabled: true } }))(
	"Permissions > sync leaf thenable (#599) > reporting a failure > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Build the fixture api under the deny-by-default rules.
		 * @returns {Promise<object>} The api.
		 */
		const build = async () => {
			api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: RULES } });
			return api;
		};

		it.each(HOWS)("%s: a hand-set processed mark does not silence the error hook", async (how) => {
			await build();
			const seen = [];
			api.slothlet.hook.on("b.give.failWith:error", ({ errorType }) => seen.push(errorType), { id: "i599-error" });
			expect(await api.a.use.fails("failWith", "forgedMark", "whoami", how)).toBe(true);
			expect(seen).toEqual(["Error"]);
		});

		it.each(HOWS)("%s: the error hook gets the class's own name as errorType, read as b", async (how) => {
			await build();
			const seen = [];
			api.slothlet.hook.on("b.give.failWith:error", ({ errorType }) => seen.push(errorType), { id: "i599-error" });
			expect(await api.a.use.fails("failWith", "staticName", "secret", how)).toBe(true);
			expect(seen).toEqual(["NamedError"]);
			expect(await api.b.give.drain()).not.toContainEqual(expect.objectContaining({ ok: true }));
		});

		it.each(Object.entries(PIPELINES))(
			"with %s, a leaf's thrown error reaches the caller as itself (#252)",
			async (_pipeline, register) => {
				await build();
				register(api);
				const original = new Error("orig");
				await expect(api.a.use.give("rethrow", original)).rejects.toBe(original);
				let caught;
				try {
					await api.b.give.rethrow(original);
				} catch (error) {
					caught = error;
				}
				expect(caught).toBe(original);
			}
		);
	}
);
