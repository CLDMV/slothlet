/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/framework-name-routes.test.vitest.mjs
 *	@Date: 2026-11-25T14:57:40-08:00 (1795647460)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:07:34-08:00 (1795651654)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview No route gives a node (or the api root) a member under a name with the framework's prefix.
 *
 * @description
 * Names with three or more leading underscores are the framework's own (`____x` state, `___x` callables). Beside the
 * export, file, mount and set-trap checks, every other route a member could take onto a node is closed:
 *
 * | route                                 | answer                                   |
 * | ------------------------------------- | ---------------------------------------- |
 * | `node[name] = v` (module or host)     | absorbed: true, nothing stored           |
 * | `Object.defineProperty(node, name)`   | absorbed: no error, nothing stored       |
 * | `Reflect.defineProperty(node, name)`  | absorbed: true, nothing stored           |
 * | a definition that would fix it        | refused: false (proxy invariant)         |
 * | `Object.setPrototypeOf(node, {name})` | set on the value; the node holds no such member |
 * | a function's own member               | stays the function's; the node holds none |
 * | a class instance's inherited method   | stays the class's; the node holds none   |
 * | the same on `self`, on the api root, on `self.slothlet` and on a run's view |
 *
 * Fixture `api_test_framework_name_routes/routes` (`lib/` beside it records every call into a planted function):
 * ```
 * probe/target.mjs   box, fn; plant(where, route, name): plants on self.probe.target[where], then adds `later`
 * probe/writer.mjs   plantOnSelf(route, name), plantOnFramework(route, name)
 * probe/statics.mjs  tool(), with tool.___createChildWrapper / tool.____state / tool.zeta; calls()
 * probe/classy.mjs   instance of a class with a ___createChildWrapper method, and zeta; calls()
 * ```
 * In every case the node still works (it makes the child after it) and the planted function is never called.
 *
 * @module tests/vitests/suites/unified-wrapper/framework-name-routes
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";

const BASE = new URL("../../../../api_tests/api_test_framework_name_routes/routes", import.meta.url).pathname;

/** Names of the wrapper's own callables, which the framework calls on a node. */
const NAMES = ["___createChildWrapper", "___createProxy", "___adoptImplChildren"];

/** What each route answers for such a name. */
const OUTCOMES = { set: "done", define: "done", reflectDefine: "done", prototype: "done" };

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const permissions of [false, true]) CONFIGS.push({ mode, runtime, permissions });
	}
}

/**
 * A function that fails the test when called.
 * @returns {Function} The function.
 */
const forbidden = () =>
	function () {
		throw new Error("a planted function was called");
	};

/**
 * Expect a value to hold no member `name`, by every way of asking.
 * @param {object} value - The node or root.
 * @param {string} name - The name.
 * @returns {void}
 */
function expectNoMember(value, name) {
	expect([name, value[name], name in value, Object.keys(value).includes(name), Reflect.ownKeys(value).includes(name)]).toEqual([
		name,
		undefined,
		false,
		false,
		false
	]);
	expect(Object.getOwnPropertyDescriptor(value, name)).toBeUndefined();
}

/**
 * Expect a node's wrapper to hold no own member `name`: what a value the node fronts carries (a function's own member,
 * a member it inherits) stays the value's, and the framework never reaches it in place of the wrapper's own.
 * @param {object} node - The node.
 * @param {string} name - The name.
 * @returns {void}
 */
function expectNotHeld(node, name) {
	expect([name, Object.hasOwn(resolveWrapper(node), name)]).toEqual([name, false]);
}

describe.each(CONFIGS)("Framework name routes > $mode / $runtime / permissions $permissions", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const build = () => slothlet({ mode, runtime, base: BASE, silent: true, ...(permissions ? { permissions: {} } : {}) });
	const loaded = async (node) => (mode === "lazy" ? await node : node);

	it.each(["box", "fn"])("module code through self: no route plants such a name on a %s node", async (where) => {
		api = await build();
		const target = await loaded(api.probe.target);
		for (const name of NAMES) {
			for (const route of Object.keys(OUTCOMES)) {
				expect([where, route, name, await target.plant(where, route, name)]).toEqual([
					where,
					route,
					name,
					{ outcome: OUTCOMES[route], later: 2 }
				]);
				const node = await loaded(target[where]);
				if (route === "prototype") expectNotHeld(node, name);
				else expectNoMember(node, name);
			}
		}
		if (where === "fn") expect(await target.fn()).toBe("fn");
		expect(await target.calls()).toEqual([]);
	});

	it("the host: no route plants such a name on a node", async () => {
		api = await build();
		const target = await loaded(api.probe.target);
		const box = await loaded(target.box);
		for (const name of NAMES) {
			box[name] = forbidden();
			Object.defineProperty(box, name, { value: forbidden(), configurable: true, writable: true, enumerable: true });
			expect(Reflect.defineProperty(box, name, { value: forbidden(), configurable: true, writable: true, enumerable: true })).toBe(true);
			expect(Reflect.defineProperty(box, name, { value: forbidden(), configurable: false })).toBe(false);
			expectNoMember(box, name);
		}
		Object.setPrototypeOf(box, { [NAMES[0]]: forbidden() });
		expectNotHeld(box, NAMES[0]);
		box.later = { nested: { leaf: 2 } };
		expect(box.later.nested.leaf).toBe(2);
		expect(box.first.leaf).toBe(1);
	});

	it("a function's own members with the prefix are not held by its node", async () => {
		api = await build();
		const statics = await loaded(api.probe.statics);
		const tool = await loaded(statics.tool);
		expectNotHeld(tool, "___createChildWrapper");
		expectNotHeld(tool, "____state");
		tool.later = { nested: { leaf: 2 } };
		expect(tool.later.nested.leaf).toBe(2);
		expect(tool.zeta.leaf).toBe(1);
		expect(await tool()).toBe("statics");
		expect(await statics.calls()).toEqual([]);
	});

	it("a method with the prefix a class instance inherits is not held by its node", async () => {
		api = await build();
		const classy = await loaded(api.probe.classy);
		const instance = await loaded(classy.instance);
		expectNotHeld(instance, "___createChildWrapper");
		expect(instance.zeta.leaf).toBe(1);
		expect(await classy.calls()).toEqual([]);
	});

	it("self, the api root and the framework's namespace take no such name", async () => {
		api = await build();
		const writer = await loaded(api.probe.writer);
		for (const name of NAMES) {
			expect(await writer.plantOnSelf("define", name)).toBe("done");
			expect(await writer.plantOnSelf("reflectDefine", name)).toBe("done");
			expect(await writer.plantOnSelf("set", name)).toMatch(/^THREW:/);
			expect(await writer.plantOnFramework("define", name)).toMatch(/^THREW:/);
			expect(await writer.plantOnFramework("set", name)).toMatch(/^THREW:/);
			expectNoMember(api, name);
			expectNoMember(api.slothlet, name);

			api[name] = forbidden();
			Object.defineProperty(api, name, { value: forbidden(), configurable: true, writable: true, enumerable: true });
			expect(Reflect.defineProperty(api, name, { value: forbidden(), configurable: true, writable: true, enumerable: true })).toBe(true);
			expect(Reflect.defineProperty(api, name, { value: forbidden(), configurable: false })).toBe(false);
			expectNoMember(api, name);
		}
		expect((await loaded(api.probe.target)).box.first.leaf).toBe(1);
	});

	it("a run's view takes no such name, on a node or on its root", async () => {
		api = await build();
		await loaded(api.probe.target);
		await api.slothlet.context.run.self({}, async (view) => {
			const box = await loaded(view.probe.target.box);
			for (const name of NAMES) {
				box[name] = forbidden();
				Object.defineProperty(box, name, { value: forbidden(), configurable: true, writable: true, enumerable: true });
				expect(Reflect.defineProperty(view, name, { value: forbidden(), configurable: true, writable: true, enumerable: true })).toBe(true);
				expectNoMember(box, name);
				expect(view[name]).toBeUndefined();
			}
			box.later = { nested: { leaf: 2 } };
			expect(box.later.nested.leaf).toBe(2);
		});
		for (const name of NAMES) expectNoMember(await loaded(api.probe.target.box), name);
	});
});
