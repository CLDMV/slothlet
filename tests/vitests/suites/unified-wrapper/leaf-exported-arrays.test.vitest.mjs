/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/leaf-exported-arrays.test.vitest.mjs
 *	@Date: 2026-06-15 00:00:00 -07:00 (1781913600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-21 17:11:18 -07:00 (1782087078)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A leaf's exported plain-data values are data, not part of the api tree to compose.
 * Nested arrays inside an exported object must survive composition as real Arrays — an array of
 * objects must keep its `Array` identity (`Array.isArray`, `length`, JSON-serializable) and an array
 * of primitives must not be dropped. Regression for the unified-wrapper turning arrays into
 * `{0,1,length:0}` array-likes. Verified in both eager and lazy modes.
 * @module tests/vitests/suites/unified-wrapper/leaf-exported-arrays
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import slothlet from "@cldmv/slothlet";

/** Unique fixture root under the project tmp folder. @param {string} tag @returns {string} */
function makeRoot(tag) {
	return resolve("tmp", `slothlet-leafarr-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Write a fixture module, creating parent dirs. @param {string} filePath @param {string} code @returns {Promise<void>} */
async function writeModule(filePath, code) {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, code);
}

const WIDGET = `
export const name = "widget";
export const items = [{ id: "a", greet() { return "hi " + this.id; } }, { id: "b" }];
export const matrix = [[1, 2], [3, 4]];
export const fns = [() => "f0", () => "f1"];
export const nums = [5, 3, 8, 1];
export const empty = [];
export const sparse = [1, , 3];
export const deep = { layers: [{ tags: ["p", "q"] }] };
export const manifest = {
	id: "widget",
	contributes: {
		views: [
			{ id: "v1", where: "left", order: 1 },
			{ id: "v2", where: "right", order: 2 }
		],
		commands: [{ id: "c1" }, { id: "c2" }]
	},
	tags: ["alpha", "beta", "gamma"]
};
export function activate() {}
export function render() { return "hi"; }
`;

describe.each([{ mode: "eager" }, { mode: "lazy" }])("Leaf-exported nested arrays survive composition ($mode)", ({ mode }) => {
	let root;
	const apis = [];

	beforeEach(async () => {
		root = makeRoot(mode);
		await writeModule(join(root, "widget", "widget.mjs"), WIDGET);
	});

	afterEach(async () => {
		for (const api of apis.splice(0)) await api?.shutdown?.();
		await rm(root, { recursive: true, force: true });
	});

	/** Boot + (in lazy mode) materialize the widget leaf so its data is readable. @returns {Promise<object>} */
	async function bootWidget() {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		// In lazy mode, calling a leaf function materializes the whole leaf (manifest included).
		if (mode === "lazy") await api.widget.render();
		return api.widget.manifest;
	}

	it("keeps an array of objects as a real Array (identity, length, JSON, elements)", async () => {
		const m = await bootWidget();
		const views = m.contributes.views;
		expect(Array.isArray(views)).toBe(true);
		expect(views.length).toBe(2);
		expect(views[0].id).toBe("v1");
		expect(views[1].where).toBe("right");
		// Was undefined when the array was rebuilt as an array-like object.
		expect(JSON.parse(JSON.stringify(views))).toEqual([
			{ id: "v1", where: "left", order: 1 },
			{ id: "v2", where: "right", order: 2 }
		]);
		expect(Array.isArray(m.contributes.commands)).toBe(true);
		expect(m.contributes.commands.length).toBe(2);
	});

	it("does not drop an array of primitives", async () => {
		const m = await bootWidget();
		expect(Array.isArray(m.tags)).toBe(true);
		expect(m.tags).toEqual(["alpha", "beta", "gamma"]);
		expect(m.tags.length).toBe(3);
	});

	it("arrays are transparent: iteration, spread, and array methods work through the wrapper", async () => {
		const m = await bootWidget();
		const views = m.contributes.views;
		expect([...views].length).toBe(2);
		expect(views.map((v) => v.id)).toEqual(["v1", "v2"]);
		const ids = [];
		for (const v of views) ids.push(v.id);
		expect(ids).toEqual(["v1", "v2"]);
	});

	it("does not leak framework-internal keys when the leaf is JSON-serialized", async () => {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		if (mode === "lazy") await api.widget.render();
		const json = JSON.parse(JSON.stringify(api.widget));
		expect(Object.keys(json).some((k) => k.startsWith("__"))).toBe(false);
		expect(json.name).toBe("widget");
		expect(json.manifest.tags).toEqual(["alpha", "beta", "gamma"]);
	});

	it("wraps array ELEMENTS as first-class UnifiedWrappers so slothlet features apply at arr[i]", async () => {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		if (mode === "lazy") await api.widget.render();
		const items = api.widget.items;
		// Array stays transparent...
		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBe(2);
		// ...but each element is a real wrapper with a proper apiPath (the hook for api.add / permission
		// rules / context at arr[i] and deeper), not a raw object.
		expect(items[0].__apiPath).toBe("widget.items.0");
		expect(items[1].__apiPath).toBe("widget.items.1");
		// Nested members on a wrapped element still work (callable + data).
		expect(items[0].greet()).toBe("hi a");
		expect(items[1].id).toBe("b");
		// Iteration and JSON still see the elements faithfully.
		expect([...items].map((el) => el.id)).toEqual(["a", "b"]);
		expect(JSON.parse(JSON.stringify(items))).toEqual([{ id: "a" }, { id: "b" }]);
	});

	it("handles nested arrays-of-arrays and arrays of functions (recursive transparency + callable elements)", async () => {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		if (mode === "lazy") await api.widget.render();
		// Array of arrays: outer + inner are both transparent arrays; JSON round-trips.
		const matrix = api.widget.matrix;
		expect(Array.isArray(matrix)).toBe(true);
		expect(Array.isArray(matrix[0])).toBe(true);
		expect(matrix[0][1]).toBe(2);
		expect(matrix[1][0]).toBe(3);
		expect(JSON.parse(JSON.stringify(matrix))).toEqual([
			[1, 2],
			[3, 4]
		]);
		// Array of functions: elements are callable (wrapped) and the array is transparent.
		const fns = api.widget.fns;
		expect(Array.isArray(fns)).toBe(true);
		expect(fns.length).toBe(2);
		expect(fns[0]()).toBe("f0");
		expect(fns[1]()).toBe("f1");
		expect(fns.map((f) => f())).toEqual(["f0", "f1"]);
	});

	it("empty and sparse arrays behave faithfully", async () => {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		if (mode === "lazy") await api.widget.render();
		expect(Array.isArray(api.widget.empty)).toBe(true);
		expect(api.widget.empty.length).toBe(0);
		expect([...api.widget.empty]).toEqual([]);
		expect(JSON.stringify(api.widget.empty)).toBe("[]");
		const sparse = api.widget.sparse;
		expect(sparse.length).toBe(3);
		expect(sparse[0]).toBe(1);
		expect(sparse[1]).toBeUndefined();
		expect(sparse[2]).toBe(3);
		expect(JSON.stringify(sparse)).toBe("[1,null,3]");
	});

	it("array methods (filter/find/reduce/includes/at/slice) and Object.keys/spread work through the wrapper", async () => {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		if (mode === "lazy") await api.widget.render();
		const nums = api.widget.nums; // [5,3,8,1] of primitives
		expect(nums.filter((n) => n > 3)).toEqual([5, 8]);
		expect(nums.find((n) => n > 4)).toBe(5);
		expect(nums.reduce((a, b) => a + b, 0)).toBe(17);
		expect(nums.includes(8)).toBe(true);
		expect(nums.at(-1)).toBe(1);
		expect(nums.slice(1, 3)).toEqual([3, 8]);
		expect(Object.keys(nums)).toEqual(["0", "1", "2", "3"]);
		expect({ ...nums }).toEqual({ 0: 5, 1: 3, 2: 8, 3: 1 });
		// Methods over an array of OBJECT elements receive the element wrappers.
		expect(api.widget.items.filter((el) => el.id === "a").length).toBe(1);
	});

	it("element wrappers have stable identity and serialize individually", async () => {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		if (mode === "lazy") await api.widget.render();
		// Same wrapper instance is returned on repeated access (live-binding identity).
		expect(api.widget.items[0]).toBe(api.widget.items[0]);
		// A single element wrapper is JSON-serializable on its own (function members omitted).
		expect(JSON.parse(JSON.stringify(api.widget.items[0]))).toEqual({ id: "a" });
	});

	it("deep mixed nesting (object → array → object → array) stays faithful + traversable", async () => {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		if (mode === "lazy") await api.widget.render();
		const deep = api.widget.deep;
		expect(Array.isArray(deep.layers)).toBe(true);
		expect(Array.isArray(deep.layers[0].tags)).toBe(true);
		expect(deep.layers[0].tags[1]).toBe("q");
		expect(JSON.parse(JSON.stringify(deep))).toEqual({ layers: [{ tags: ["p", "q"] }] });
	});

	it("mounts a FROZEN array via api.add without crashing and stays transparent (M1 regression)", async () => {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		const frozenDir = makeRoot(`${mode}-frozen`);
		await writeModule(join(frozenDir, "frozen.mjs"), `export const frozen = Object.freeze([{ a: 1 }, { b: 2 }]);\n`);
		// Pre-fix this threw "Cannot define property Symbol(nodejs.util.inspect.custom), object is not extensible".
		await api.slothlet.api.add("plug", frozenDir);
		const arr = api.plug.frozen;
		expect(Array.isArray(arr)).toBe(true);
		expect(arr.length).toBe(2);
		expect(arr[0].a).toBe(1);
		expect(JSON.parse(JSON.stringify(arr))).toEqual([{ a: 1 }, { b: 2 }]);
		await rm(frozenDir, { recursive: true, force: true });
	});

	it("the enclosing object is JSON-serializable and keeps scalar exports (wrapper opaque to the outside)", async () => {
		const m = await bootWidget();
		expect(m.id).toBe("widget");
		// The wrapper must serialize as the underlying data, not undefined.
		expect(JSON.parse(JSON.stringify(m))).toEqual({
			id: "widget",
			contributes: {
				views: [
					{ id: "v1", where: "left", order: 1 },
					{ id: "v2", where: "right", order: 2 }
				],
				commands: [{ id: "c1" }, { id: "c2" }]
			},
			tags: ["alpha", "beta", "gamma"]
		});
	});
});

// Array elements are full slothlet nodes — not just transparent data. Because each element is a
// UnifiedWrapper with a real apiPath, the runtime features the user requires work at arr[i] and
// deeper: api.add can mount under an element, and permission rules target an element's methods.
describe("Array elements are full slothlet nodes (api.add + permission gating)", () => {
	let root;
	const apis = [];
	const extraDirs = [];

	beforeEach(async () => {
		root = makeRoot("nodes");
		await writeModule(
			join(root, "data.mjs"),
			`export const items = [{ id: "x", run() { return "secret-" + this.id; }, plugin: { hello() { return "hello"; }, bye() { return "bye"; } } }];\n`
		);
		await writeModule(
			join(root, "caller.mjs"),
			`import { self } from "@cldmv/slothlet/runtime";\n` +
				`export async function go() { return self.data.items[0].run(); }\n` +
				`export async function callHello() { return self.data.items[0].plugin.hello(); }\n` +
				`export async function callBye() { return self.data.items[0].plugin.bye(); }\n`
		);
	});

	afterEach(async () => {
		for (const api of apis.splice(0)) await api?.shutdown?.();
		await rm(root, { recursive: true, force: true });
		for (const d of extraDirs.splice(0)) await rm(d, { recursive: true, force: true });
	});

	it("api.add mounts a sub-api UNDER an array element (api.add into a portion of the array)", async () => {
		const api = await slothlet({ base: root, mode: "eager" });
		apis.push(api);
		const extraDir = makeRoot("extra");
		extraDirs.push(extraDir);
		await writeModule(join(extraDir, "hello.mjs"), `export function hello() { return "added"; }\n`);
		await api.slothlet.api.add("data.items.0.extension", extraDir);
		expect(api.data.items[0].extension.hello()).toBe("added");
		// element stays transparent after the mount
		expect(Array.isArray(api.data.items)).toBe(true);
		expect(api.data.items[0].run()).toBe("secret-x");
	});

	it("permission rules gate a method on an array element (deny-all via an inter-module caller)", async () => {
		const api = await slothlet({ base: root, mode: "eager", permissions: { defaultPolicy: "allow" } });
		apis.push(api);
		// Allowed by default: caller.go() calls self.data.items[0].run() (an inter-module call).
		expect(await api.caller.go()).toBe("secret-x");
		// Deny everything under the array element for the caller — gating keys off the element apiPath.
		api.slothlet.permissions.addRule({ caller: "caller.**", target: "data.items.**", effect: "deny" });
		await expect(api.caller.go()).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("denies ONE deep path on an array element (data.items.*.plugin.hello) while siblings pass", async () => {
		const api = await slothlet({ base: root, mode: "eager", permissions: { defaultPolicy: "allow" } });
		apis.push(api);
		// `*` must match the array index, and gating must be path-precise: deny only plugin.hello.
		api.slothlet.permissions.addRule({ caller: "caller.**", target: "data.items.*.plugin.hello", effect: "deny" });
		await expect(api.caller.callHello()).rejects.toThrow(/PERMISSION_DENIED/);
		// Sibling method on the same nested object — allowed.
		expect(await api.caller.callBye()).toBe("bye");
		// Other method on the element — allowed.
		expect(await api.caller.go()).toBe("secret-x");
	});

	it("under defaultPolicy 'deny', an explicit allow on a deep element path lets just that through", async () => {
		const api = await slothlet({
			base: root,
			mode: "eager",
			permissions: { defaultPolicy: "deny", rules: [{ caller: "caller.**", target: "data.items.*.plugin.hello", effect: "allow" }] }
		});
		apis.push(api);
		// Only data.items.*.plugin.hello is allowed; everything else under the element is denied.
		expect(await api.caller.callHello()).toBe("hello");
		await expect(api.caller.callBye()).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(api.caller.go()).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("api.remove of a sub-api mounted UNDER an array element removes only that leaf (siblings + ancestors preserved)", async () => {
		const api = await slothlet({ base: root, mode: "eager" });
		apis.push(api);
		const extraDir = makeRoot("extra-rm");
		extraDirs.push(extraDir);
		await writeModule(join(extraDir, "hello.mjs"), `export function hello() { return "added"; }\n`);
		await api.slothlet.api.add("data.items.0.extension", extraDir);
		expect(api.data.items[0].extension.hello()).toBe("added");

		await api.slothlet.api.remove("data.items.0.extension");

		// Only the mounted leaf is gone — the deep mount must NOT tear down the
		// surrounding `data` namespace (regression: removeApiComponent's defensive
		// cleanup used split(".")[0] and deleted api.data wholesale).
		expect(api.data.items[0].extension).toBeUndefined();
		// Ancestors survive...
		expect(typeof api.data).toBe("object");
		expect(Array.isArray(api.data.items)).toBe(true);
		expect(typeof api.data.items[0]).toBe("object");
		// ...and so do the element's own original members.
		expect(api.data.items[0].run()).toBe("secret-x");
		expect(api.data.items[0].plugin.hello()).toBe("hello");
		// The array stays a real, JSON-serializable Array.
		expect(() => JSON.stringify(api.data.items)).not.toThrow();
	});

	it("re-adds under the same array-element path after a remove (ownership not poisoned)", async () => {
		const api = await slothlet({ base: root, mode: "eager" });
		apis.push(api);
		const d1 = makeRoot("extra-readd-1");
		const d2 = makeRoot("extra-readd-2");
		extraDirs.push(d1, d2);
		await writeModule(join(d1, "hello.mjs"), `export function hello() { return "first"; }\n`);
		await writeModule(join(d2, "hello.mjs"), `export function hello() { return "second"; }\n`);

		await api.slothlet.api.add("data.items.0.extension", d1);
		expect(api.data.items[0].extension.hello()).toBe("first");
		await api.slothlet.api.remove("data.items.0.extension");
		expect(api.data.items[0].extension).toBeUndefined();

		await api.slothlet.api.add("data.items.0.extension", d2);
		expect(api.data.items[0].extension.hello()).toBe("second");
		// Sibling still intact through the add/remove/add cycle.
		expect(api.data.items[0].run()).toBe("secret-x");
	});
});
