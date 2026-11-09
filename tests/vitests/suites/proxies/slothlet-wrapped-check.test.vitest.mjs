/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/slothlet-wrapped-check.test.vitest.mjs
 *	@Date: 2026-11-08T16:13:51-08:00 (1794183231)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:58:25-08:00 (1794185905)
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
 * - every value slothlet makes and hands out in place of a module's or the host's answers true: api nodes, nodes not
 *   loaded yet, per-reader, member, root, and framework views, version dispatchers, class-instance wrappers, guarded
 *   promoted results, and the stand-ins, Proxies or not;
 * - plain values, primitives, and any Proxy slothlet didn't make, including one wrapped around slothlet's own and
 *   one whose traps claim anything, answer false;
 * - no trap of the value runs while it's asked, and replacing `WeakSet`/`WeakMap` methods afterwards changes no answer;
 * - module code may ask it under `defaultPolicy: "deny"`, and a host rule of equal specificity can still deny it.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { types } from "node:util";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { runtime_isWrappedClassInstance, runtime_wrapClassInstance } from "@cldmv/slothlet/helpers/class-instance-wrapper";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, "../../../../api_tests/api_test_wrapped_check");
const VERSIONED = path.resolve(__dirname, "../../../../api_tests/api_test_versioned");

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

	it("answers true for every value slothlet hands the host in place of a module's", async () => {
		api = await slothlet({ ...config, base: BASE });
		// The root api, a node, its member nodes, a class instance and a closure it returns, and the framework's namespace.
		expect(api.slothlet.wrapped(api)).toBe(true);
		expect(api.slothlet.wrapped(api.bag)).toBe(true);
		expect(api.slothlet.wrapped(api.bag.makeThing)).toBe(true);
		expect(api.slothlet.wrapped(api.bag.data)).toBe(true);
		expect(api.slothlet.wrapped(await api.bag.makeThing())).toBe(true);
		expect(api.slothlet.wrapped(await api.bag.makeFn())).toBe(true);
		expect(api.slothlet.wrapped(api.slothlet)).toBe(true);
	});

	it("answers true for a class-instance wrapper", async () => {
		api = await slothlet({ ...config, base: BASE });
		// The wrapper a class instance gets when it is returned outside any module's call, built directly.
		const contextManager = { runInContext: (_id, fn, thisArg, args) => Reflect.apply(fn, thisArg, args) };
		const thing = runtime_wrapClassInstance(new (class Thing {})(), contextManager, "wrapped-check", new WeakMap());
		expect(runtime_isWrappedClassInstance(thing)).toBe(true);
		expect(api.slothlet.wrapped(thing)).toBe(true);
	});

	it("answers true for a method read through a composition layer", async () => {
		api = await slothlet({ ...config, base: BASE });
		const layered = config.mode === "lazy" ? await api.layered : api.layered;
		expect(await layered.greet()).toBe(1);
		expect(api.slothlet.wrapped(layered.greet)).toBe(true);
	});

	it("answers true for the stand-ins that are not Proxies", async () => {
		api = await slothlet({ ...config, base: BASE });
		const asyncFn = await api.bag.makeAsyncFn();
		const genFn = await api.bag.makeGenFn();
		const genObject = await api.bag.makeGenObject();
		const { promise } = await api.bag.makePromise();
		// Each is a function, generator, or promise of the original's own kind, not a Proxy.
		expect(types.isAsyncFunction(asyncFn)).toBe(true);
		expect(types.isGeneratorFunction(genFn)).toBe(true);
		expect(types.isGeneratorObject(genObject)).toBe(true);
		expect(types.isPromise(promise)).toBe(true);
		for (const value of [asyncFn, genFn, genObject, promise]) expect(types.isProxy(value)).toBe(false);
		expect(api.slothlet.wrapped(asyncFn)).toBe(true);
		expect(api.slothlet.wrapped(genFn)).toBe(true);
		expect(api.slothlet.wrapped(genObject)).toBe(true);
		expect(api.slothlet.wrapped(promise)).toBe(true);
		await promise;
	});

	it("answers true for a node not loaded yet", async () => {
		api = await slothlet({ ...config, base: BASE });
		// Nothing has been read under api.bag yet, so in lazy mode these are the stand-ins of nodes still to load.
		expect(api.slothlet.wrapped(api.bag)).toBe(true);
		expect(api.slothlet.wrapped(api.bag.makeThing)).toBe(true);
	});

	it("answers true for version dispatchers, on the host's side and the module's", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.slothlet.api.add(["exts"], `${VERSIONED}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add(["exts"], `${VERSIONED}/v2`, {}, { version: "v2" });
		expect(api.slothlet.wrapped(api.exts)).toBe(true);
		expect(await api.bag.checkDispatcher()).toBe(true);
	});

	it("answers true for every view module code is handed of the framework's namespace and of the api", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.bag.checkModuleViews()).toEqual({
			self: true,
			"self.slothlet": true,
			"self.slothlet.event": true,
			"self.slothlet.event.on": true,
			"self.slothlet.api": true,
			"self.slothlet.hook": true,
			"self.slothlet.metadata": true,
			"self.slothlet.wrapped": true,
			"self.bag": true,
			"self.bag.data": true,
			"self.bag.data.list": true,
			"self.bag.makeThing": true,
			"self.bag.Thing.prototype": true,
			"self.bag.Thing.prototype.value": true
		});
	});

	it("answers true for the views one module gets of another's values, member views included", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.reader.checkViews()).toEqual({
			"self.bag": true,
			"self.bag.data": true,
			"self.bag.data.list": true,
			"self.bag.Thing": true,
			"self.bag.Thing.prototype": true,
			"self.bag.Thing.prototype.value": true,
			"self.bag.makeThing": true
		});
	});

	it("answers true for the root api view a module's hook is handed", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		await api.bag.hookRoot();
		await api.bag.syncValue();
		expect(await api.bag.hookAnswers()).toEqual([true]);
	});

	it("answers true for the guarded result of a call an async hook promoted", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		// Loaded first, so the promoted call is the function's own and not a lazy node's first load.
		expect(await api.bag.syncValue()).toBe(1);
		api.slothlet.hook.on("bag.syncValue:before", async () => {});
		const result = api.bag.syncValue();
		expect(types.isProxy(result)).toBe(true);
		expect(api.slothlet.wrapped(result)).toBe(true);
		expect(await result).toBe(1);
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
		expect(await api.bag.checkOwnView()).toEqual({ isProxy: true, wrapped: true });
	});

	it("lets a host rule of equal specificity deny it to module code", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target: "slothlet.wrapped", effect: "deny" }] }
		});
		await expect((async () => api.bag.check({}))()).rejects.toThrow(/PERMISSION_DENIED/);
	});
});
