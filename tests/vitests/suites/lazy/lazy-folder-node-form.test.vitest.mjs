/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-folder-node-form.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:21-08:00 (1794882561)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A lazy folder node, once loaded, has the form eager gives the same node (#811).
 *
 * @description
 * A lazy node is built before what it holds is known, on a function target, since a folder may turn out callable,
 * and a Proxy's form is fixed by its target. Once it loads a namespace (no function), it is rebuilt on the object
 * target eager builds it on: `typeof` is `"object"`, it is no function to `Function.prototype.toString`, and calling
 * it throws the engine's `TypeError`, as eager. A callable folder stays a function. The comparison is the same node of
 * an eager instance, for the host and for a module through `self`, with the permission system off and on.
 * @module tests/vitests/suites/lazy/lazy-folder-node-form
 */

import { describe, it, expect, afterEach } from "vitest";
import util from "node:util";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const FIXTURE = new URL("../../../../api_tests/api_test_function_builtin_names/", import.meta.url);
const DIR = fileURLToPath(new URL("base", FIXTURE));
const CALLABLE = fileURLToPath(new URL("callable", FIXTURE));

/** The nodes compared: namespace folders (one nested), a folder holding one file, a file node, callable folders. */
const NODES = ["deep", "deep.inner", "probe", "math", "named", "cm"];

/**
 * The member of the api at a dotted path.
 * @param {object} api - The api.
 * @param {string} where - The path.
 * @returns {*} The member.
 */
const at = (api, where) => where.split(".").reduce((node, key) => node[key], api);

/**
 * What the language tells of a value's form, without calling into the module's code.
 * @param {*} node - The value.
 * @returns {Record<string, *>} Its form.
 */
const formOf = (node) => {
	const form = { typeof: typeof node, tag: Object.prototype.toString.call(node), isFunction: node instanceof Function };
	try {
		Function.prototype.toString.call(node);
		form.functionSource = true;
	} catch (error) {
		form.functionSource = error.constructor.name;
	}
	form.keys = Object.keys(node);
	form.inspect = util.inspect(node, { depth: 0 });
	return form;
};

/**
 * What calling a value throws or answers, when it is not callable.
 * @param {*} node - The value.
 * @returns {string} `"callable"`, or the name of the error a call throws.
 */
const callOf = (node) => {
	if (typeof node === "function") return "callable";
	try {
		node();
		return "called";
	} catch (error) {
		return error.constructor.name;
	}
};

/**
 * Build an instance over the fixture with every compared node loaded.
 * @param {object} config - The matrix config.
 * @param {string} mode - `"eager"` or `"lazy"`.
 * @param {object} [permissions] - The permissions config.
 * @returns {Promise<object>} The api.
 */
const build = async (config, mode, permissions) => {
	const api = await slothlet({ ...config, mode, base: DIR, silent: true, ...(permissions ? { permissions } : {}) });
	await api.slothlet.api.add(["cm"], CALLABLE);
	await api.deep;
	await api.deep.inner;
	await api.probe;
	await api.math;
	await api.named;
	await api.cm;
	return api;
};

describe.each(getMatrixConfigs({ mode: "lazy" }))("Lazy > a loaded folder node's form (#811) > $name", ({ config }) => {
	let apis = [];

	afterEach(async () => {
		for (const api of apis) await api.shutdown();
		apis = [];
	});

	it.each([
		["permissions off", undefined],
		["permissions on", { policy: "allow" }]
	])("matches eager for the host and through self: %s", async (_label, permissions) => {
		const lazy = await build(config, "lazy", permissions);
		const eager = await build(config, "eager", permissions);
		apis = [lazy, eager];
		for (const where of NODES) {
			expect(formOf(at(lazy, where)), where).toEqual(formOf(at(eager, where)));
			expect(callOf(at(lazy, where)), where).toBe(callOf(at(eager, where)));
			// A module's view of the node through `self`.
			expect((await lazy.probe.read(where, "constructor")).held, `self.${where}`).toBe((await eager.probe.read(where, "constructor")).held);
		}
	});

	it("keeps a reference taken before the load reading the loaded node's members", async () => {
		const api = await slothlet({ ...config, base: DIR, silent: true });
		apis = [api];
		const held = api.deep;
		await api.deep;
		await api.deep.inner;
		expect(Object.keys(held)).toEqual(Object.keys(api.deep));
		expect(held.inner.walk(1, 2, 3)).toBe("1/2/3");
		expect(typeof api.deep).toBe("object");
	});

	it("takes an unloaded node's form again when a reload resets it, and stays printable", async () => {
		const api = await slothlet({ ...config, base: DIR, silent: true, api: { mutations: { reload: true } } });
		apis = [api];
		const held = api.deep;
		await api.deep;
		const loaded = api.deep;
		expect(typeof loaded).toBe("object");
		await api.slothlet.api.reload(".");
		// Unloaded again: the lazy proxy it was before the load, in its form.
		expect(api.deep).toBe(held);
		expect(typeof api.deep).toBe("function");
		// A failed comparison prints both values; neither may recurse without end.
		expect(() => expect(loaded).toBe(held)).toThrow(/expected/);
		expect(() => expect(held).toBe(loaded)).toThrow(/expected/);
		// Loaded again, both references read the node's members.
		await api.deep;
		await api.deep.inner;
		expect(typeof api.deep).toBe("object");
		expect(Object.keys(loaded)).toEqual(Object.keys(api.deep));
		expect(loaded.inner.walk(1, 2, 3)).toBe("1/2/3");
		expect(held.inner.walk(1, 2, 3)).toBe("1/2/3");
	});

	it("prints a loaded node held past its remove as eager prints it", async () => {
		const shown = {};
		for (const mode of ["lazy", "eager"]) {
			const api = await slothlet({ ...config, mode, base: DIR, silent: true, api: { mutations: { remove: true } } });
			apis.push(api);
			await api.deep;
			const loaded = api.deep;
			await api.slothlet.api.remove("deep");
			// A failed comparison prints the value; it may not recurse without end.
			expect(() => expect(loaded).toBe(null), mode).toThrow(/expected/);
			shown[mode] = util.inspect(loaded, { depth: 0 });
		}
		expect(shown.lazy).toBe(shown.eager);
	});
});
