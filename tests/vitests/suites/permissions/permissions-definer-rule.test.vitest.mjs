/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-definer-rule.test.vitest.mjs
 *	@Date: 2026-11-08T19:11:26-08:00 (1794193886)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T22:59:48-08:00 (1794207588)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #726 — a `self.*` call is allowed only when both the code that defined the calling function (its
 * definer: the leaf whose source range holds it, or the file's module for code outside every export) and the caller
 * running it (the call it runs in, or the host) are allowed. Defining, storing, returning or passing a function checks
 * nothing. Holds under both values of `permissions.attribution`, in eager and lazy mode, in both runtimes.
 *
 * @description
 * Fixture `api_test_definer_rule`. Rules: `bag.** -> vault.**`, `** -> bag.**`, `** -> shared.**`,
 * `mixed.trusted -> vault.**`; default deny.
 *
 * Rulings (from the maintainer's decision on #726):
 * - A: a closure `bag` made, run by `supplier` — denied.
 * - B: a function in data `bag` returned, run by `supplier` — denied.
 * - C: `supplier`'s `toString` run inside `bag.echo` — denied.
 * - D: `supplier`'s callback run by `bag.call` — denied.
 * - E: `supplier`'s function kept by `shared`, run by `reader` — denied.
 * - plain calls — allowed; the host running `api.bag.make()()` — allowed; `bag` running a function it made — allowed;
 *   an instance method from `bag` run by `supplier` — denied.
 * - A thenable `lender` returns runs its `then` as `lender` though `bag` awaits it, on the first call into a node not
 *   yet loaded too — denied.
 * - `x.**` covers the module path `x` (`**` matches zero segments): a rule on `mixed.**` names code outside every
 *   export of `mixed`, in every mode, as a rule on `mixed` itself does.
 * - The stack names the definer wherever it can: a helper a leaf returns is its file's module's, not that leaf's.
 *
 * @module tests/vitests/suites/permissions/permissions-definer-rule
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_definer_rule");
const DENIED = "PERMISSION_DENIED";
const RULES = [
	{ caller: "bag.**", target: "vault.**", effect: "allow" },
	{ caller: "**", target: "bag.**", effect: "allow" },
	{ caller: "**", target: "shared.**", effect: "allow" },
	{ caller: "mixed.trusted", target: "vault.**", effect: "allow" }
];
const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/**
 * Run code from the host, reporting a refusal by its code.
 * @param {Function} fn - The code.
 * @returns {Promise<*>} What it returned, or the code of what it threw.
 */
const settle = async (fn) => {
	try {
		return await fn();
	} catch (e) {
		return e?.code ?? String(e?.message ?? e);
	}
};

describe.each(MATRIX)("Permissions > definer and caller both allowed > $name (#726)", ({ attribution, mode, runtime }) => {
	let api;
	let supplier;
	let reader;

	beforeAll(async () => {
		api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions: { defaultPolicy: "deny", attribution, rules: RULES } });
		// Materialize what the rulings touch, so a lazy node answers as an eager one.
		await api.vault.get();
		await api.shared.take();
		await api.bag.echo(1);
		supplier = await api.supplier.run();
		reader = await api.reader.run();
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it("A: a closure bag made, run by supplier, is refused", () => expect(supplier.A).toBe(DENIED));
	it("B: a function in data bag returned, run by supplier, is refused", () => expect(supplier.B).toBe(DENIED));
	it("C: supplier's toString run inside bag.echo is refused", () => expect(supplier.C).toBe(DENIED));
	it("D: supplier's callback run by bag.call is refused", () => expect(supplier.D).toBe(DENIED));
	it("E: supplier's function kept by shared, run by reader, is refused", () => expect(reader.E).toBe(DENIED));
	it("supplier calling the vault directly is refused", () => expect(supplier.direct).toBe(DENIED));

	it("plain calls are allowed and pass functions and data through", () => {
		expect(supplier.makePlain).toBe("function");
		expect(supplier.boxPlain).toBe("function");
		expect(supplier.echoResult).toBe("x");
		expect(supplier.keepPlain).toBe("ok");
		expect(supplier.echoPlain).toBe("5");
		expect(supplier.callPlain).toBe(7);
		expect(reader.takePlain).toBe("function");
	});

	it("the host running a closure bag made is allowed (definer bag.make, caller the host)", async () => {
		const fn = await api.bag.make();
		expect(await settle(() => fn())).toBe(42);
	});

	it("bag running a function it made is allowed, by a local call and through self", async () => {
		expect(await settle(() => api.bag.own())).toBe(42);
		expect(await settle(() => api.bag.ownViaSelf())).toBe(42);
	});

	it("bag's leaf running supplier's function fetched from shared is refused (definer supplier)", async () => {
		expect(await settle(() => api.bag.runKept())).toBe(DENIED);
	});

	it("a class instance's method bag made, run by supplier, is refused", () => expect(supplier.instance).toBe(DENIED));

	it("the host running a function in data bag returned is allowed", async () => {
		const data = await api.bag.box();
		expect(await settle(() => data.run())).toBe(42);
	});

	it("the host running a class instance's method bag made is allowed", async () => {
		const instance = await api.bag.inst();
		expect(await settle(() => instance.run())).toBe(42);
	});

	it("the definer is the leaf whose source range holds the code, not every leaf of its file", async () => {
		const trusted = await api.mixed.trusted();
		const plain = await api.mixed.plain();
		expect(await settle(() => trusted())).toBe(42);
		expect(await settle(() => plain())).toBe(DENIED);
	});

	it("code outside every export is the file's module, which no rule allows: refused with PERMISSION_DENIED", async () => {
		const viaHelper = await api.mixed.viaHelper();
		expect(await settle(() => viaHelper())).toBe(DENIED);
	});
});

describe.each(MATRIX)("Permissions > definer rule > what is told from the stack > $name (#726)", ({ attribution, mode, runtime }) => {
	let api = null;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	/**
	 * An instance of the fixture, nothing loaded yet.
	 * @param {object} permissions - `defaultPolicy` and `rules`.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (permissions) => {
		api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions: { attribution, ...permissions } });
		return api;
	};

	it("a thenable lender returns runs its then as lender though bag awaits it, on the first call and after", async () => {
		await build({ defaultPolicy: "deny", rules: [...RULES, { caller: "**", target: "lender.**", effect: "allow" }] });
		expect(await settle(() => api.bag.awaitLender())).toBe(DENIED);
		expect(await settle(() => api.bag.awaitLender())).toBe(DENIED);
	});

	it("a rule allowing mixed.** covers code outside every export of mixed: the host running its helper reads the vault", async () => {
		await build({ defaultPolicy: "deny", rules: [...RULES, { caller: "mixed.**", target: "vault.**", effect: "allow" }] });
		const helper = await api.mixed.viaHelper();
		expect(await settle(() => helper())).toBe(42);
	});

	it("a rule denying mixed.** covers code outside every export of mixed, run by the host and inside bag's call", async () => {
		await build({ defaultPolicy: "allow", rules: [{ caller: "mixed.**", target: "vault.**", effect: "deny" }] });
		const helper = await api.mixed.viaHelper();
		expect(await settle(() => helper())).toBe(DENIED);
		expect(await settle(() => api.bag.call(helper))).toBe(DENIED);
	});

	it("a rule on the module path mixed names code outside every export of mixed, and no leaf of it", async () => {
		await build({ defaultPolicy: "allow", rules: [{ caller: "mixed", target: "vault.**", effect: "deny" }] });
		const helper = await api.mixed.viaHelper();
		expect(await settle(() => helper())).toBe(DENIED);
		expect(await settle(() => api.bag.call(helper))).toBe(DENIED);
		const trusted = await api.mixed.trusted();
		expect(await settle(() => trusted())).toBe(42);
	});

	it("a helper a leaf returns is defined by its file's module, not by the leaf that returned it", async () => {
		await build({ defaultPolicy: "deny", rules: [...RULES, { caller: "mixed.trustedHands", target: "vault.**", effect: "allow" }] });
		const helper = await api.mixed.trustedHands();
		expect(await settle(() => helper())).toBe(DENIED);
		expect(await settle(() => api.bag.call(helper))).toBe(DENIED);
	});

	it("a module's own function bag hands back on its own runs as that module, whoever runs it", async () => {
		await build({ defaultPolicy: "deny", rules: RULES });
		await api.vault.get();
		const fn = await api.supplier.pickOwn();
		expect(await settle(() => fn())).toBe(DENIED);
		expect(await settle(() => api.bag.call(fn))).toBe(DENIED);
	});

	it("a node's own Proxy export runs its traps as a call of the node, through the node and as a value handed back", async () => {
		await build({ defaultPolicy: "deny", rules: RULES });
		await api.vault.get();
		expect(await api.supplier.proxiedTraps()).toEqual({ get: 42, has: true, ownKeys: ["k42"], handedGet: 42, handedHas: true });
	});
});
