/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-definer-rule.test.vitest.mjs
 *	@Date: 2026-11-08T19:11:26-08:00 (1794193886)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T19:19:50-08:00 (1794194390)
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
 *
 * @module tests/vitests/suites/permissions/permissions-definer-rule
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
