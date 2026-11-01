/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-round4.test.vitest.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — code a module creates runs as that module, whoever runs it: accessors and iterators nested on
 * its api objects, a Proxy it exports, generators it returns, and functions and iterators its functions return.
 *
 * @description
 * Fixture: `callee` (mounted) may call `vault.secret.secret`; `supplier` (mounted) may call `callee.**` and its own
 * module, and may not call the secret. Each test is a way of getting the supplier's code run by the callee or the
 * host; the code runs as the supplier, with whoever runs it as its ceiling, so the secret is refused.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-round4
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";
import { describeFunction } from "../../../../api_tests/api_test_caller_supplied_round4/callee/__lib/describe.mjs";

const DIR = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND4;

/** Deny by default; the secret is the callee's alone. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "supplier.**", target: "callee.**", effect: "allow" },
	{ caller: "supplier.**", target: "supplier.**", effect: "allow" },
	{ caller: "callee.**", target: "supplier.bag.**", effect: "allow" },
	// The callee writes through the supplier's objects, which only a write grant lets one module do to another's (#625).
	{ caller: "callee.**", target: "supplier.bag.**:write", effect: "allow" }
];

const DENIED = "PERMISSION_DENIED";

/**
 * Whether this engine gives a stack frame the hash of the script it runs in, which is what tells a file's own code
 * from code compiled under its name.
 * @type {boolean}
 */
const HAS_SCRIPT_HASH = (() => {
	const previous = Error.prepareStackTrace;
	Error.prepareStackTrace = (_error, sites) => sites;
	const sites = new Error().stack;
	Error.prepareStackTrace = previous;
	return typeof sites?.[0]?.getScriptHash === "function";
})();

describe.each(getMatrixConfigs())("Permissions > caller-supplied code, fourth round (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the base and mount the callee and the supplier as modules of their own.
	 * @param {object} [permissions] - Permissions to build with instead of the fixture's rules.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (permissions = { defaultPolicy: "deny", rules: RULES }) => {
		api = await slothlet({ ...config, base: path.join(DIR, "base"), permissions });
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		await api.slothlet.api.add("supplier", path.join(DIR, "supplier"), { moduleID: "supplier-mod" });
		await api.vault.secret.whoami();
		return api;
	};

	it("control: the callee's own call is its own", async () => {
		await build();
		expect(await api.callee.ops.secretDirect()).toBe("s3cret");
	});

	it.runIf(HAS_SCRIPT_HASH)("control: the callee's CommonJS helper whose source is not valid UTF-8 is the callee's code", async () => {
		await build();
		expect(await api.supplier.probe.ownLatinControl()).toEqual({ ok: true, value: "s3cret" });
	});

	describe("code nested on the supplier's api objects, run by the callee", () => {
		it("a setter the callee writes through", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.setterThroughCallee())).toBe(DENIED);
		});

		it("an iterator the callee spreads", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.iterableThroughCallee())).toEqual({
				ok: true,
				value: [DENIED]
			});
		});

		it("a getter the callee takes from its descriptor and runs on another receiver", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.detachedGetterThroughCallee())).toEqual({
				ok: true,
				value: DENIED
			});
		});
	});

	describe("a Proxy the supplier exports", () => {
		it("handed to the callee", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.proxiedThroughCallee())).toEqual({
				ok: true,
				value: DENIED
			});
		});

		it("read by the callee through self", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.callee.ops.proxiedViaSelf())).toBe(DENIED);
		});
	});

	describe("generators the supplier returns", () => {
		it("iterated by the callee it is handed to", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.genThroughCallee())).toEqual({ ok: true, value: [DENIED] });
		});

		it.each(["genViaSelf", "agenViaSelf", "symbolGenViaSelf"])("%s: iterated by the callee through self", async (probe) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.callee.ops[probe]())).toEqual([DENIED]);
		});

		it("iterated by the host", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => [...api.supplier.bag.gen()])).toEqual([DENIED]);
		});

		it("control: a generator object keeps its identity, prototype and protocol", async () => {
			await build({ defaultPolicy: "allow", rules: [] });
			const generator = api.supplier.bag.gen();
			expect(Object.prototype.toString.call(generator)).toBe("[object Generator]");
			expect(generator[Symbol.iterator]()).toBe(generator);
			expect(Object.keys(generator)).toEqual([]);
			expect(
				(function* () {
					yield* generator;
				})().next()
			).toEqual({ value: "s3cret", done: false });
			expect(generator.next()).toEqual({ value: undefined, done: true });
			const second = api.supplier.bag.gen();
			expect(second.return(5)).toEqual({ value: 5, done: true });
			const third = api.supplier.bag.gen();
			expect(() => third.throw(new Error("boom"))).toThrow("boom");
		});
	});

	describe("functions and iterators the supplier returns", () => {
		it("a function handed to the callee", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.madeThroughCallee())).toEqual({ ok: true, value: DENIED });
		});

		it.each(["madeViaSelf", "iterViaSelf", "classViaSelf"])("%s: called by the callee through self", async (probe) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.callee.ops[probe]())).toBe(DENIED);
		});

		it("a function called by the host", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.bag.make()())).toBe(DENIED);
		});

		it("control: a returned function keeps its plain-JavaScript shape", async () => {
			await build({ defaultPolicy: "allow", rules: [] });
			const fn = api.supplier.bag.shaped();
			expect([fn.name, fn.length, typeof fn.prototype, typeof fn]).toEqual(["shapedOne", 2, "object", "function"]);
			expect(fn.call({ tag: "t" }, 1, 2)).toEqual(["t", 1, 2]);
			expect(fn.apply({ tag: "u" }, [3, 4])).toEqual(["u", 3, 4]);
			expect(fn.bind({ tag: "v" }, 5)(6)).toEqual(["v", 5, 6]);
			expect(api.supplier.bag.same()).toBe(api.supplier.bag.same());
			expect(api.supplier.bag.isSame(api.supplier.bag.same())).toBe(true);
			const Made = api.supplier.bag.makeClass();
			const made = new Made(3);
			expect([made instanceof Made, made.value, Object.getPrototypeOf(made) === Made.prototype, Made.name]).toEqual([
				true,
				3,
				true,
				"Made"
			]);
			expect(made.answer).toBe("s3cret");
		});
	});
});

// With the permission system disabled: off still keeps module code from changing the framework's own namespace.
describe.each(getMatrixConfigs())(
	"Permissions disabled > a slothlet function a module reads reports what the host's does (#597) > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Build the base and mount the callee.
		 * @returns {Promise<object>} The api.
		 */
		const build = async () => {
			api = await slothlet({ ...config, base: path.join(DIR, "base"), permissions: { mode: "disabled" } });
			await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
			return api;
		};

		it("an async function keeps its prototype", async () => {
			await build();
			expect(await api.callee.shapes.report("scope")).toEqual(describeFunction(api.slothlet.scope));
			expect((await api.callee.shapes.report("scope")).prototype).toBe("AsyncFunction");
		});

		it("a prototype set by the module is the function's", async () => {
			await build();
			expect(await api.callee.shapes.reparent("scope")).toBe(true);
			expect(Object.getPrototypeOf(api.slothlet.scope)).toBe(Function.prototype);
			expect((await api.callee.shapes.report("scope")).prototype).toBe("Function");
		});

		it("a member defined naming only its value is reported fixed, as on the function", async () => {
			await build();
			const reported = await api.callee.shapes.define("scope", "extra");
			expect(reported.member).toEqual({ configurable: false, writable: false, enumerable: false });
			expect(reported).toEqual(describeFunction(api.slothlet.scope, "extra"));
		});

		it("a member the function holds fixed is reported fixed", async () => {
			await build();
			expect(await api.callee.shapes.report("lockCaller")).toEqual(describeFunction(api.slothlet.lockCaller));
		});

		it.each([
			["frozen", Object.freeze],
			["sealed", Object.seal],
			["made non-extensible", Object.preventExtensions]
		])("%s by the host after the module read it, it reports as the host's", async (_label, fix) => {
			await build();
			await api.callee.shapes.keep("lockCaller");
			fix(api.slothlet.lockCaller);
			expect(await api.callee.shapes.report("lockCaller")).toEqual(describeFunction(api.slothlet.lockCaller));
		});
	}
);
