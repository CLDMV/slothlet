/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-made-proxy.test.vitest.mjs
 *	@Date: 2026-11-25T02:01:16-08:00 (1795600876)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:12-08:00 (1795869192)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A Proxy a module makes and hands out answers every operation the caller makes on it as the same Proxy
 * does in plain JS: reads, method calls, getters, writes, definitions, deletions, listings, descriptions, prototype
 * changes and closing it.
 *
 * Fixture: `api_tests/api_test_uwa_made` — `factory.makeProxy`.
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_uwa_made/api");

const CONFIGS = [];
for (const permissions of ["on", "off"])
	for (const [mode, runtime] of [
		["eager", "async"],
		["lazy", "live"]
	])
		CONFIGS.push({ mode, runtime, permissions });

/**
 * The same Proxy `factory.makeProxy` makes, built here.
 * @returns {object} The proxy.
 */
function plainProxy() {
	const target = {
		n: 1,
		run() {
			return "ran";
		},
		get doubled() {
			return this.n * 2;
		}
	};
	return new Proxy(target, {});
}

/**
 * Every operation the test compares, in order, on `proxy`.
 * @param {object} proxy - The proxy.
 * @returns {object} What each gave.
 */
function exercise(proxy) {
	const seen = {
		n: proxy.n,
		run: proxy.run(),
		doubled: proxy.doubled,
		has: ["n" in proxy, "absent" in proxy],
		keys: Object.keys(proxy),
		described: Object.getOwnPropertyDescriptor(proxy, "n"),
		getterKind: typeof Object.getOwnPropertyDescriptor(proxy, "doubled").get
	};
	proxy.n = 3;
	seen.written = [proxy.n, proxy.doubled];
	seen.defined = Reflect.defineProperty(proxy, "fixed", { value: 7, enumerable: true });
	seen.fixed = [proxy.fixed, Object.getOwnPropertyDescriptor(proxy, "fixed").writable];
	seen.deleted = [Reflect.deleteProperty(proxy, "run"), "run" in proxy];
	const linked = { inherited: 1 };
	seen.relinked = [Reflect.setPrototypeOf(proxy, linked), proxy.inherited];
	seen.extensible = Object.isExtensible(proxy);
	seen.closed = [Reflect.preventExtensions(proxy), Object.isExtensible(proxy), Object.keys(proxy)];
	seen.afterClose = [Reflect.defineProperty(proxy, "late", { value: 1 }), proxy.fixed, Object.getOwnPropertyDescriptor(proxy, "n").value];
	seen.relinkClosed = Reflect.setPrototypeOf(proxy, {});
	return seen;
}

describe.each(CONFIGS)("a Proxy a module hands out — $mode / $runtime / permissions $permissions", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("answers every operation as the same Proxy does", async () => {
		api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, ...(permissions === "on" ? { permissions: {} } : {}) });
		const proxy = await api.factory.makeProxy();
		expect(exercise(proxy)).toEqual(exercise(plainProxy()));
	});
});
