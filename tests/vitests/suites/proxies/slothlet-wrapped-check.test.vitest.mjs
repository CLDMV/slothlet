/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/slothlet-wrapped-check.test.vitest.mjs
 *	@Date: 2026-11-08T16:13:51-08:00 (1794183231)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:16:59-08:00 (1794183419)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.wrapped(value)` (#671): whether a value is a Proxy slothlet itself made,
 * answered without running any trap of the value. A host or a module copying values between modules can
 * then let slothlet's own wrappers through and still refuse every other Proxy.
 *
 * Contract:
 * - every Proxy slothlet hands out (api nodes, per-reader views, class-instance wrappers, stand-ins) answers true;
 * - plain values, primitives, and any Proxy slothlet didn't make, including one wrapped around slothlet's own and
 *   one whose traps claim anything, answer false;
 * - no trap of the value runs while it's asked, and replacing `WeakSet`/`WeakMap` methods afterwards changes no answer;
 * - module code may ask it under `defaultPolicy: "deny"`.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { types } from "node:util";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, "../../../../api_tests/api_test_wrapped_check");

/**
 * A Proxy whose every trap counts its calls and answers as if it were anything.
 * @returns {{ proxy: object, calls: () => number }} The proxy and its trap-call counter.
 */
function hostile() {
	let calls = 0;
	const answer = () => {
		calls++;
		return true;
	};
	const proxy = new Proxy(
		{},
		{
			get: () => (calls++, true),
			has: answer,
			getPrototypeOf: () => (calls++, Object.prototype),
			getOwnPropertyDescriptor: () => (calls++, { value: true, configurable: true, enumerable: true, writable: true }),
			ownKeys: () => (calls++, []),
			isExtensible: () => (calls++, true),
			defineProperty: answer,
			set: answer,
			deleteProperty: answer,
			preventExtensions: () => (calls++, false),
			setPrototypeOf: answer
		}
	);
	return { proxy, calls: () => calls };
}

describe.each(getMatrixConfigs())("Proxies > api.slothlet.wrapped > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("answers true for every Proxy slothlet hands out", async () => {
		api = await slothlet({ ...config, base: BASE });
		const handedOut = [api, api.bag, api.bag.makeThing, api.bag.data, await api.bag.makeThing(), await api.bag.makeFn(), api.slothlet];
		for (const value of handedOut) {
			if (types.isProxy(value)) expect(api.slothlet.wrapped(value)).toBe(true);
		}
		// The api node itself is always one of slothlet's.
		expect(api.slothlet.wrapped(api.bag)).toBe(true);
	});

	it("answers false for plain values and primitives", async () => {
		api = await slothlet({ ...config, base: BASE });
		for (const value of [{}, [], () => {}, new Map(), null, undefined, 0, "", Symbol("s"), 1n]) {
			expect(api.slothlet.wrapped(value)).toBe(false);
		}
	});

	it("answers false for a Proxy slothlet didn't make, and runs none of its traps", async () => {
		api = await slothlet({ ...config, base: BASE });
		const { proxy, calls } = hostile();
		expect(api.slothlet.wrapped(proxy)).toBe(false);
		expect(calls()).toBe(0);
	});

	it("answers false for a Proxy someone wrapped around slothlet's own", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(api.slothlet.wrapped(new Proxy(api.bag, {}))).toBe(false);
	});

	it("keeps its answers when WeakSet and WeakMap methods are replaced afterwards", async () => {
		api = await slothlet({ ...config, base: BASE });
		const { proxy, calls } = hostile();
		const saved = { set: WeakSet.prototype.has, map: WeakMap.prototype.has };
		try {
			WeakSet.prototype.has = () => true;
			WeakMap.prototype.has = () => true;
			expect(api.slothlet.wrapped(proxy)).toBe(false);
			expect(api.slothlet.wrapped({})).toBe(false);
			WeakSet.prototype.has = () => false;
			WeakMap.prototype.has = () => false;
			expect(api.slothlet.wrapped(api.bag)).toBe(true);
		} finally {
			WeakSet.prototype.has = saved.set;
			WeakMap.prototype.has = saved.map;
		}
		expect(calls()).toBe(0);
	});

	it("is available to module code under defaultPolicy deny", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "deny", rules: [] } });
		const { proxy } = hostile();
		expect(await api.bag.check({})).toBe(false);
		expect(await api.bag.check(proxy)).toBe(false);
		const own = await api.bag.checkOwnView();
		if (own.isProxy) expect(own.wrapped).toBe(true);
	});
});
