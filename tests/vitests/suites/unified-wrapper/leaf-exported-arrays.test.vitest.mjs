/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/leaf-exported-arrays.test.vitest.mjs
 *	@Date: 2026-06-15T00:00:00-07:00 (1781506800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-13T05:12:47-07:00 (1791893567)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf's exported plain-data values are data, not part of the api tree to compose.
 * Nested arrays inside an exported object must survive composition as real Arrays — an array of
 * objects must keep its `Array` identity (`Array.isArray`, `length`, JSON-serializable) and an array
 * of primitives must not be dropped. Regression for the unified-wrapper turning arrays into
 * `{0,1,length:0}` array-likes. Verified in both eager and lazy modes.
 * @module tests/vitests/suites/unified-wrapper/leaf-exported-arrays
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import nodeUtil from "node:util";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";

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

	it("an exported Array subclass instance keeps its constructor and its class's methods, as in plain JS", async () => {
		await writeModule(
			join(root, "lists", "lists.mjs"),
			`export class MyList extends Array { sum() { return this.reduce((a, b) => a + b, 0); } }\nexport const list = MyList.from([1, 2, 3]);\n`
		);
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		await api.lists;
		const list = api.lists.list;
		expect(list.constructor.name).toBe("MyList");
		expect(list.constructor).toBe(Object.getPrototypeOf(list).constructor);
		expect(list.sum()).toBe(6);
		expect(list instanceof api.lists.MyList).toBe(true);
		expect([...list.map((x) => x * 2)]).toEqual([2, 4, 6]);
	});

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

	it("a member mounted at a key past the array-index range is reported as a member, not an index", async () => {
		const api = await slothlet({ base: root, mode: "eager" });
		apis.push(api);
		const extraDir = makeRoot("extra");
		extraDirs.push(extraDir);
		await writeModule(join(extraDir, "hello.mjs"), `export function hello() { return "added"; }\n`);
		await api.slothlet.api.add("data.items.4294967295", extraDir);
		const items = api.data.items;
		expect(items.length).toBe(1);
		expect("4294967295" in items).toBe(true);
		expect(Object.keys(items)).toContain("4294967295");
		expect(items[4294967295].hello()).toBe("added");
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

// Writes through an array member reach the array itself, as they would on the array directly (#602):
// the module's own reference sees them, and `length`, iteration and element reads all agree.
const BOX = `
const box = {
	items: [1, 2, 3],
	views: [{ id: "v1" }, { id: "v2" }],
	add(x) {
		this.items.push(x);
		return this.items.length;
	}
};
export default box;
export const peek = () => ({ items: [...box.items], views: box.views.map((view) => view.id) });
export const truncate = (count) => {
	box.views.length = count;
};
`;

describe.each([{ mode: "eager" }, { mode: "lazy" }])("Writes through an array member reach the array (#602, $mode)", ({ mode }) => {
	let root;
	const apis = [];

	beforeEach(async () => {
		root = makeRoot(`writes-${mode}`);
		await writeModule(join(root, "box", "box.mjs"), BOX);
	});

	afterEach(async () => {
		for (const api of apis.splice(0)) await api?.shutdown?.();
		await rm(root, { recursive: true, force: true });
	});

	/** Boot the api and (in lazy mode) load the box. @returns {Promise<object>} */
	async function boot() {
		const api = await slothlet({ base: root, mode });
		apis.push(api);
		await api.box.peek();
		return api;
	}

	it("a write through a named-export array reaches the module's own array", async () => {
		await writeModule(
			join(root, "list.mjs"),
			`export const items = [1, 2];\nexport const tags = [{ id: "t1" }];\nexport const peek = () => ({ items: [...items], tags: tags.map((tag) => tag.id) });\n`
		);
		const api = await boot();
		await api.list.peek();
		expect(api.list.items.push(3)).toBe(3);
		api.list.items[0] = 9;
		api.list.tags.push({ id: "t2" });
		expect(await api.list.peek()).toEqual({ items: [9, 2, 3], tags: ["t1", "t2"] });
	});

	it("a method's `this.items.push()` grows the array, and the module's own reference sees it", async () => {
		const api = await boot();
		expect(await api.box.add(9)).toBe(4);
		expect([...api.box.items]).toEqual([1, 2, 3, 9]);
		expect(api.box.items.length).toBe(4);
		expect((await api.box.peek()).items).toEqual([1, 2, 3, 9]);
	});

	it("push, pop, index writes, `length` writes and splice through the api agree with the array", async () => {
		const api = await boot();
		const items = api.box.items;
		expect(items.push(4)).toBe(4);
		items[0] = 100;
		expect(items.pop()).toBe(4);
		expect(items[3]).toBeUndefined();
		expect([...items]).toEqual([100, 2, 3]);
		items.splice(1, 1);
		expect([...items]).toEqual([100, 3]);
		items.length = 1;
		expect([...items]).toEqual([100]);
		expect((await api.box.peek()).items).toEqual([100]);
	});

	it("replacing or removing an object element is seen by the next read, through the api and the module", async () => {
		const api = await boot();
		const views = api.box.views;
		expect(views[0].id).toBe("v1");
		views[0] = { id: "n1" };
		expect(views[0].id).toBe("n1");
		views.shift();
		expect(views.length).toBe(1);
		expect(views[0].id).toBe("v2");
		expect(views[1]).toBeUndefined();
		expect((await api.box.peek()).views).toEqual(["v2"]);
	});

	it("reflection reports what the array holds now, after cached elements were truncated through the api or the module", async () => {
		const api = await boot();
		const views = api.box.views;
		expect(views[1].id).toBe("v2");
		views.length = 1;
		expect(Object.keys(views)).toEqual(["0"]);
		expect(1 in views).toBe(false);
		expect(Object.getOwnPropertyDescriptor(views, "1")).toBeUndefined();
		expect(Object.getOwnPropertyDescriptor(views, "length").value).toBe(1);
		views.push({ id: "v3" });
		expect(views[1].id).toBe("v3");
		await api.box.truncate(0);
		expect(Object.keys(views)).toEqual([]);
		expect(0 in views).toBe(false);
		expect([...views]).toEqual([]);
	});

	it("an element taken out with shift() and pushed back is held by the module's array as itself", async () => {
		await writeModule(
			join(root, "box", "box.mjs"),
			BOX +
				"const originals = [...box.views];\nexport const holdsOriginal = (index, original) => box.views[index] === originals[original];\n"
		);
		const api = await boot();
		const views = api.box.views;
		const first = views.shift();
		expect(views.push(first)).toBe(2);
		expect(await api.box.holdsOriginal(1, 0)).toBe(true);
		expect(await api.box.holdsOriginal(0, 1)).toBe(true);
		expect(views[1].id).toBe("v1");
	});

	it("deleting a namespace member retires its wrapper; an element an array method moves keeps working", async () => {
		const api = await boot();
		const views = api.box.views;
		const second = views[1];
		views.shift();
		expect(resolveWrapper(second).____slothletInternal.invalid).toBeFalsy();
		expect(views[0].id).toBe("v2");
		const items = api.box.items;
		expect(delete api.box.items).toBe(true);
		expect(api.box.items).toBeUndefined();
		expect(resolveWrapper(items).____slothletInternal.invalid).toBe(true);
	});
});

describe("A held array reference keeps writing to the array after an eager reload (#602)", () => {
	let root;
	let api;

	beforeEach(async () => {
		root = makeRoot("reload");
		await writeModule(join(root, "box", "box.mjs"), BOX);
	});

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		await rm(root, { recursive: true, force: true });
	});

	it("push through a reference taken before reload reaches the reloaded module's array", async () => {
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		await api.slothlet.api.reload("box");
		expect(items).toBe(api.box.items);
		expect(items.push(9)).toBe(4);
		expect([...items]).toEqual([1, 2, 3, 9]);
		expect(Object.keys(items)).toEqual(["0", "1", "2", "3"]);
		expect((await api.box.peek()).items).toEqual([1, 2, 3, 9]);
	});

	it("a held array made non-extensible stays within the proxy invariants when a reload changes its shape", async () => {
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		Object.preventExtensions(items);
		await writeModule(join(root, "box", "box.mjs"), BOX.replace("items: [1, 2, 3]", "items: [9]"));
		await api.slothlet.api.reload("box");
		expect(() => Object.keys(items)).not.toThrow();
		expect(() => Object.getOwnPropertyDescriptors(items)).not.toThrow();
		expect(() => 1 in items).not.toThrow();
		// It takes no index its target does not already hold, as a non-extensible array does not.
		expect(() => {
			items[10] = 5;
		}).toThrow(TypeError);
		expect(10 in items).toBe(false);
	});

	it("deleting a configurable index of a non-extensible member after a reload removes it from the reloaded array", async () => {
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		Object.preventExtensions(items);
		await writeModule(join(root, "box", "box.mjs"), BOX.replace("items: [1, 2, 3]", "items: [9, 8, 7]"));
		await api.slothlet.api.reload("box");
		// As on a non-extensible array, whose indices stay configurable: the index is deleted, leaving a hole.
		expect(Reflect.deleteProperty(items, "0")).toBe(true);
		expect(0 in items).toBe(false);
		expect((await api.box.peek()).items).toEqual([undefined, 8, 7]);
		expect(() => Object.keys(items)).not.toThrow();
		expect(Object.keys(items)).toEqual(["1", "2"]);
	});

	it("shortening a sparse array of the largest length through a held reference does not walk every index", async () => {
		await writeModule(join(root, "box", "box.mjs"), BOX + "export const stretch = () => {\n\tbox.items.length = 4294967295;\n};\n");
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		await api.slothlet.api.reload("box");
		await api.box.stretch();
		expect(items.length).toBe(4294967295);
		Object.defineProperty(items, "length", { value: 2 });
		expect(items.length).toBe(2);
		expect((await api.box.peek()).items).toEqual([1, 2]);
	}, 10000);

	it("Object.defineProperty through a held reference reaches the reloaded module's array", async () => {
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		await api.slothlet.api.reload("box");
		Object.defineProperty(items, "0", { value: 7 });
		expect(items[0]).toBe(7);
		expect(Object.getOwnPropertyDescriptor(items, "0").value).toBe(7);
		expect((await api.box.peek()).items).toEqual([7, 2, 3]);
		Object.defineProperty(items, "3", { value: 4, writable: true, enumerable: true, configurable: true });
		expect(items.length).toBe(4);
		expect((await api.box.peek()).items).toEqual([7, 2, 3, 4]);
	});

	it("a definition the reloaded module's array refuses leaves the held reference unchanged", async () => {
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		await writeModule(
			join(root, "box", "box.mjs"),
			BOX.replace("items: [1, 2, 3]", "items: [9, 8, 7]") + "export const freeze = () => {\n\tObject.freeze(box.items);\n};\n"
		);
		await api.slothlet.api.reload("box");
		await api.box.freeze();
		expect(() => Object.defineProperty(items, "0", { value: 1, writable: false, configurable: false })).toThrow(TypeError);
		expect(items[0]).toBe(9);
		expect(Object.getOwnPropertyDescriptor(items, "0").value).toBe(9);
		expect(Object.keys(items)).toEqual(["0", "1", "2"]);
	});

	it("a frozen held array refuses writes and deletes without touching the reloaded module's array", async () => {
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		Object.freeze(items);
		await writeModule(join(root, "box", "box.mjs"), BOX.replace("items: [1, 2, 3]", "items: [9, 8, 7]"));
		await api.slothlet.api.reload("box");
		expect(() => {
			items[0] = 5;
		}).toThrow(TypeError);
		expect(() => {
			delete items[1];
		}).toThrow(TypeError);
		expect(() => Object.defineProperty(items, "2", { value: 6 })).toThrow(TypeError);
		expect((await api.box.peek()).items).toEqual([9, 8, 7]);
	});
});

describe.each([{ mode: "eager" }, { mode: "lazy" }])("An array element's path follows its position ($mode)", ({ mode }) => {
	let root;
	let api;

	beforeEach(async () => {
		root = makeRoot(`position-${mode}`);
		await writeModule(
			join(root, "data.mjs"),
			`export const items = [{ id: "x", run() { return "run-" + this.id; } }, { id: "y", run() { return "run-" + this.id; } }];\n`
		);
		await writeModule(
			join(root, "caller.mjs"),
			`import { self } from "@cldmv/slothlet/runtime";\n` +
				`let held;\n` +
				`export async function hold(index) { held = self.data.items[index]; return held.id; }\n` +
				`export async function callHeld() { return held.run(); }\n`
		);
	});

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		await rm(root, { recursive: true, force: true });
	});

	it("a held element reports the index it sits at now, and the array's path once it leaves the array", async () => {
		api = await slothlet({ base: root, mode });
		await api.caller.hold(0);
		const second = api.data.items[1];
		expect(second.__slothletPath).toBe("data.items.1");
		const first = api.data.items.shift();
		expect(second.__slothletPath).toBe("data.items.0");
		expect(second.run.__slothletPath).toBe("data.items.0.run");
		expect(first.__slothletPath).toBe("data.items");
		expect(first.run()).toBe("run-x");
	});

	it("an element's path is resolved without calling an indexOf the array holds", async () => {
		await writeModule(
			join(root, "data.mjs"),
			`export const items = [{ id: "x" }, { id: "y" }];\n` +
				`let calls = 0;\n` +
				`Object.defineProperty(items, "indexOf", { value(...args) { calls++; return Array.prototype.indexOf.apply(this, args); }, writable: true, configurable: true });\n` +
				`export const indexOfCalls = () => calls;\n`
		);
		api = await slothlet({ base: root, mode });
		const second = api.data.items[1];
		api.data.items.shift();
		expect(second.__slothletPath).toBe("data.items.0");
		expect(await api.data.indexOfCalls()).toBe(0);
	});

	it("a read of an element its array holds through a getter runs the getter once", async () => {
		await writeModule(
			join(root, "data.mjs"),
			`const element = { id: "g" };\n` +
				`let reads = 0;\n` +
				`export const items = [];\n` +
				`Object.defineProperty(items, "0", { get() { reads++; return element; }, enumerable: true, configurable: true });\n` +
				`export const readCount = () => reads;\n`
		);
		api = await slothlet({ base: root, mode });
		expect(api.data.items[0].id).toBe("g");
		const before = await api.data.readCount();
		expect(api.data.items[0].id).toBe("g");
		expect((await api.data.readCount()) - before).toBe(1);
	});

	it("a rule for an index applies to the element at that index, including a reference held from before it moved", async () => {
		api = await slothlet({ base: root, mode, permissions: { defaultPolicy: "allow" } });
		expect(await api.caller.hold(1)).toBe("y");
		api.slothlet.permissions.addRule({ caller: "caller.**", target: "data.items.0.**", effect: "deny" });
		expect(await api.caller.callHeld()).toBe("run-y");
		api.data.items.shift();
		await expect(api.caller.callHeld()).rejects.toThrow(/PERMISSION_DENIED/);
	});
});

const INTEGRITY_BOX = `
const box = { items: [1, 2, 3] };
export default box;
export const state = () => ({
	items: [...box.items],
	keys: Object.keys(box.items),
	frozen: Object.isFrozen(box.items),
	sealed: Object.isSealed(box.items),
	extensible: Object.isExtensible(box.items)
});
`;

/**
 * Operations on an array, each applied to the api member and to a plain array, which must agree.
 * @type {Array<[string, (array: unknown[]) => unknown]>}
 */
const INTEGRITY_OPS = [
	["freeze", (array) => Object.freeze(array)],
	["seal", (array) => Object.seal(array)],
	["preventExtensions", (array) => Object.preventExtensions(array)],
	["define a new index", (array) => Object.defineProperty(array, "5", { value: 6, writable: true, enumerable: true, configurable: true })],
	["define a read-only length", (array) => Object.defineProperty(array, "length", { writable: false })],
	["delete an index", (array) => delete array[0]],
	["set an index", (array) => (array[1] = 20)],
	["push", (array) => array.push(4)],
	[
		"preventExtensions, then a shorter length",
		(array) => {
			Object.preventExtensions(array);
			array.length = 1;
		}
	]
];

/** What an array looks like, for comparing the api member with a plain array. @param {unknown[]} array @returns {object} */
const surface = (array) => ({
	items: [...array],
	keys: Object.keys(array),
	length: array.length,
	frozen: Object.isFrozen(array),
	sealed: Object.isSealed(array),
	extensible: Object.isExtensible(array)
});

/** Run an op, reporting a throw by its type. @param {Function} op @param {unknown[]} array @returns {string} */
const attempt = (op, array) => {
	try {
		op(array);
		return "ok";
	} catch (error) {
		return error.constructor.name;
	}
};

describe("Integrity operations on an array member match a plain array, before and after an eager reload (#603)", () => {
	let root;
	let api;

	beforeEach(async () => {
		root = makeRoot("integrity");
		await writeModule(join(root, "box", "box.mjs"), INTEGRITY_BOX);
	});

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		await rm(root, { recursive: true, force: true });
	});

	const RELOADS = [
		["not reloaded", null],
		["reloaded to the same shape", "[9, 8, 7]"],
		["reloaded shorter", "[9]"],
		["reloaded longer", "[9, 8, 7, 6]"]
	];

	for (const [reloadLabel, reloadedItems] of RELOADS) {
		for (const [opLabel, op] of INTEGRITY_OPS) {
			it(`${opLabel} on the member, ${reloadLabel}`, async () => {
				api = await slothlet({ base: root, mode: "eager" });
				expect(api.box.items.length).toBe(3);
				if (reloadedItems) {
					await writeModule(join(root, "box", "box.mjs"), INTEGRITY_BOX.replace("[1, 2, 3]", reloadedItems));
					await api.slothlet.api.reload("box");
				}
				const items = api.box.items;
				const plain = [...(await api.box.state()).items];
				expect(attempt(op, items)).toBe(attempt(op, plain));
				expect(surface(items)).toEqual(surface(plain));
				const after = await api.box.state();
				expect({ items: after.items, keys: after.keys, frozen: after.frozen, sealed: after.sealed, extensible: after.extensible }).toEqual({
					items: [...plain],
					keys: Object.keys(plain),
					frozen: Object.isFrozen(plain),
					sealed: Object.isSealed(plain),
					extensible: Object.isExtensible(plain)
				});
			});
		}
	}

	it("an index at or past a read-only length is refused after a reload, and the reloaded array is left as it was", async () => {
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		Object.defineProperty(items, "length", { writable: false });
		await writeModule(join(root, "box", "box.mjs"), INTEGRITY_BOX.replace("[1, 2, 3]", "[9, 8, 7]"));
		await api.slothlet.api.reload("box");
		expect(Reflect.set(items, "3", 1)).toBe(false);
		expect(Reflect.defineProperty(items, "4", { value: 1, writable: true, enumerable: true, configurable: true })).toBe(false);
		expect((await api.box.state()).items).toEqual([9, 8, 7]);
		expect(items.length).toBe(3);
	});

	it("a pop on a non-extensible member leaves its reflection on the elements the array holds", async () => {
		api = await slothlet({ base: root, mode: "eager" });
		const items = api.box.items;
		Object.preventExtensions(items);
		expect(items.pop()).toBe(3);
		expect(Object.keys(items)).toEqual(["0", "1"]);
		expect(2 in items).toBe(false);
		expect(items.length).toBe(2);
		expect((await api.box.state()).items).toEqual([1, 2]);
	});

	for (const [reloadLabel, reloadedItems] of RELOADS.slice(1)) {
		it(`a reference held from before the reload is the live member, and freezing it freezes the reloaded array, ${reloadLabel}`, async () => {
			api = await slothlet({ base: root, mode: "eager" });
			const held = api.box.items;
			await writeModule(join(root, "box", "box.mjs"), INTEGRITY_BOX.replace("[1, 2, 3]", reloadedItems));
			await api.slothlet.api.reload("box");
			const current = (await api.box.state()).items;
			expect(held).toBe(api.box.items);
			expect([...held]).toEqual(current);
			expect(held.length).toBe(current.length);
			// The member's target is a shell of its own, never an earlier array, so it freezes to the array it holds now.
			expect(() => Object.freeze(held)).not.toThrow();
			expect(Object.isFrozen(held)).toBe(true);
			expect(await api.box.state()).toMatchObject({ items: current, frozen: true, extensible: false });
			expect([...api.box.items]).toEqual(current);
		});
	}
});

const COMPOSED_LIST = `
const list = [1, 2];
export default list;
export const label = "L";
export const first = () => list[0];
export const state = () => ({ sealed: Object.isSealed(list), frozen: Object.isFrozen(list), extensible: Object.isExtensible(list) });
`;

const COMPOSED_READONLY = `
const list = Object.defineProperty([1, 2], "length", { writable: false });
export default list;
export const label = "L";
`;

const EDGE_BOX = `
const far = [{ id: "a" }];
far["4294967295"] = { id: "far" };
export const items = far;
const tag = Symbol.for("slothlet.test.tag");
far.meta = { v: 1 };
far[0][tag] = { deep: 1 };
export const plain = { meta: { v: 1 } };
let reads = 0;
const fresh = [];
Object.defineProperty(fresh, 0, { get: () => ({ id: ++reads }), enumerable: true, configurable: true });
export const getters = fresh;
export const readCount = () => reads;
const twin = { id: "twin" };
const dupe = [twin];
dupe["4294967295"] = twin;
export const dupes = dupe;
export const protoList = [1, 2];
const symTag = Symbol.for("slothlet.test.protoTag");
const symProto = Object.create(Array.prototype);
symProto[symTag] = { v: 1 };
export const symList = Object.setPrototypeOf([1], symProto);
export const defList = [5, 6];
const inheritedA = { id: "ia" };
const inheritedB = { id: "ib" };
const inheritedHolder = { 0: inheritedA, 1: inheritedB };
const inheritedMover = [];
inheritedMover.length = 2;
Object.setPrototypeOf(inheritedMover, inheritedHolder);
export const mover = inheritedMover;
export const moveInherited = () => {
	inheritedHolder[0] = inheritedB;
	delete inheritedHolder[1];
};
const virtualElement = { id: "virtual" };
export const virtualList = new Proxy(new Array(1), { get: (target, key, receiver) => (key === "0" ? virtualElement : Reflect.get(target, key, receiver)) });
export const trapped = new Proxy(Object.assign([1], { meta: { v: 1 } }), { deleteProperty: () => false });
const proxyTag = Symbol.for("slothlet.test.proxyTag");
export const proxied = new Proxy({ [proxyTag]: { v: 1 } }, {});
const lockedList = [1];
lockedList.meta = { v: 1 };
Object.defineProperty(lockedList, "meta", { configurable: false });
export const locked = lockedList;
export const frozenList = Object.freeze([1, 2]);
export const sealedList = Object.seal([1, 2]);
export const fixedList2 = Object.preventExtensions([1, 2]);
export const readOnlyLength = Object.defineProperty([1, 2], "length", { writable: false });
const inheritedElement = { id: "inherited" };
const inheritor = [];
inheritor.length = 1;
Object.setPrototypeOf(inheritor, { 0: inheritedElement });
export const inheritor_ = inheritor;
export const fixedList = [1, 2, 3];
export const guarded = new Proxy([1, 2], { preventExtensions: () => false });
`;

describe.each([{ mode: "eager" }, { mode: "lazy" }])(
	"Array members at the edges of the index range and of integrity operations ($mode, #603)",
	({ mode }) => {
		let root;
		let api;

		beforeEach(async () => {
			root = makeRoot(`edge-${mode}`);
			await writeModule(join(root, "box", "box.mjs"), EDGE_BOX);
			await writeModule(join(root, "lst.mjs"), COMPOSED_LIST);
			await writeModule(join(root, "lst2.mjs"), COMPOSED_READONLY);
			api = await slothlet({ base: root, mode, silent: true });
			await api.box;
			await api.lst;
			await api.lst2;
		});

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
			await rm(root, { recursive: true, force: true });
		});

		it("a member named 4294967295 is a property, not a position: its path stays when the property is deleted", () => {
			const held = api.box.items["4294967295"];
			expect(held.__slothletPath).toBe("box.items.4294967295");
			delete api.box.items["4294967295"];
			expect(held.__slothletPath).toBe("box.items.4294967295");
		});

		it("preventExtensions on an array whose own preventExtensions refuses is refused, as on the array", () => {
			const guarded = api.box.guarded;
			expect(() => Object.preventExtensions(guarded)).toThrow(TypeError);
			expect(Object.isExtensible(guarded)).toBe(true);
		});

		it("a symbol-keyed member of an array element has a path and reads, as on an object", () => {
			const tag = Symbol.for("slothlet.test.tag");
			const member = api.box.items[0][tag];
			expect(member.deep).toBe(1);
			expect(member.__slothletPath).toBe("box.items.0.Symbol(slothlet.test.tag)");
		});

		it("deleting a named member of an array invalidates its wrapper, as deleting an object's member does", () => {
			const onArray = api.box.items.meta;
			const onObject = api.box.plain.meta;
			expect(onArray.v).toBe(1);
			delete api.box.items.meta;
			delete api.box.plain.meta;
			expect(onArray.v).toBe(onObject.v);
			expect(api.box.items.meta).toBeUndefined();
		});

		it("an indexed getter runs once per read, also when an element was cached from an earlier read", async () => {
			const first = api.box.getters[0];
			expect(first.id).toBe(1);
			const second = api.box.getters[0];
			expect(second.id).toBe(2);
			expect(await api.box.readCount()).toBe(2);
		});

		it("a value kept under 4294967295 does not stand in for a position the element has left", () => {
			const held = api.box.dupes[0];
			expect(held.__slothletPath).toBe("box.dupes.0");
			delete api.box.dupes[0];
			expect(held.__slothletPath).toBe("box.dupes");
		});

		it("a prototype set on an array member is the one it reports, before and after it is sealed", () => {
			const list = api.box.protoList;
			const custom = Object.create(Array.prototype);
			expect(Object.setPrototypeOf(list, custom)).toBe(list);
			expect(Object.getPrototypeOf(list)).toBe(custom);
			Object.preventExtensions(list);
			expect(Object.getPrototypeOf(list)).toBe(custom);
			expect(list instanceof Array).toBe(true);
			expect(Reflect.setPrototypeOf(list, Array.prototype)).toBe(false);
		});

		it("an index at or past a read-only length is refused, as on an array", () => {
			const list = api.box.fixedList;
			Object.defineProperty(list, "length", { writable: false });
			expect(Reflect.set(list, "3", 9)).toBe(false);
			expect(Reflect.defineProperty(list, "4", { value: 9, writable: true, enumerable: true, configurable: true })).toBe(false);
			expect(list.length).toBe(3);
			expect(Object.keys(list)).toEqual(["0", "1", "2"]);
		});

		it("an element an array inherits keeps the index it was read at", () => {
			const held = api.box.inheritor_[0];
			expect(held.id).toBe("inherited");
			expect(held.__slothletPath).toBe("box.inheritor_.0");
		});

		it.each([
			["frozen", "frozenList", () => Object.freeze([1, 2])],
			["sealed", "sealedList", () => Object.seal([1, 2])],
			["non-extensible", "fixedList2", () => Object.preventExtensions([1, 2])],
			["read-only length", "readOnlyLength", () => Object.defineProperty([1, 2], "length", { writable: false })]
		])("an exported %s array reports the integrity it has, as the array does", (_label, name, make) => {
			const member = api.box[name];
			const plain = make();
			const describeIt = (array) => ({
				...surface(array),
				// A fixed element is an accessor on the member (it keeps the permission check on every read), so only its flags are compared.
				first: (({ configurable, enumerable }) => ({ configurable, enumerable }))(Object.getOwnPropertyDescriptor(array, "0")),
				length: Object.getOwnPropertyDescriptor(array, "length"),
				push: attempt((a) => a.push(3), array)
			});
			expect(describeIt(member)).toEqual(describeIt(plain));
		});

		it("a symbol-keyed member of an object behind a user proxy reads, as through the proxy", () => {
			const proxyTag = Symbol.for("slothlet.test.proxyTag");
			expect(api.box.proxied[proxyTag].v).toBe(1);
		});

		it("deleting a non-configurable named member of an array fails and leaves its wrapper live", () => {
			const held = api.box.locked.meta;
			expect(Reflect.deleteProperty(api.box.locked, "meta")).toBe(false);
			expect(held.v).toBe(1);
			expect(api.box.locked.meta.v).toBe(1);
		});

		it.each([
			["preventExtensions", (node) => Object.preventExtensions(node), { extensible: false, sealed: false, frozen: false }],
			["seal", (node) => Object.seal(node), { extensible: false, sealed: true, frozen: false }],
			["freeze", (node) => Object.freeze(node), { extensible: false, sealed: true, frozen: true }]
		])("%s on an array node that also holds a member leaves the node and its members readable", (_name, op, expected) => {
			const node = api.lst;
			expect(Array.isArray(node)).toBe(true);
			expect(() => op(node)).not.toThrow();
			expect({ extensible: Object.isExtensible(node), sealed: Object.isSealed(node), frozen: Object.isFrozen(node) }).toEqual({
				extensible: Object.isExtensible(node),
				...expected
			});
			expect(Object.isExtensible(node)).toBe(false);
			expect([...node]).toEqual([1, 2]);
			expect(node.label).toBe("L");
			expect(Reflect.set(node, "5", 1)).toBe(false);
		});

		it("a delete the array's own proxy refuses leaves the member's wrapper live", () => {
			const held = api.box.trapped.meta;
			expect(Reflect.deleteProperty(api.box.trapped, "meta")).toBe(false);
			expect(held.v).toBe(1);
			expect(api.box.trapped.meta.v).toBe(1);
		});

		it("an object an array proxy supplies from its get trap keeps the index it was read at", () => {
			const held = api.box.virtualList[0];
			expect(held.id).toBe("virtual");
			expect(held.__slothletPath).toBe("box.virtualList.0");
		});

		it("an inherited element moved to another inherited index follows it", async () => {
			const held = api.box.mover[1];
			expect(held.__slothletPath).toBe("box.mover.1");
			await api.box.moveInherited();
			expect(held.__slothletPath).toBe("box.mover.0");
		});

		it("a proxy array's virtual element keeps its index without asking whether the array is a proxy", () => {
			const held = api.box.virtualList[0];
			expect(held.__slothletPath).toBe("box.virtualList.0");
			// Where the engine cannot tell a proxy (browser builds), the answer must not depend on it.
			const spy = vi.spyOn(nodeUtil.types, "isProxy").mockReturnValue(false);
			try {
				expect(held.__slothletPath).toBe("box.virtualList.0");
			} finally {
				spy.mockRestore();
			}
		});

		it.each([
			["seal", (node) => Object.seal(node), { sealed: true, frozen: false, extensible: false }],
			["freeze", (node) => Object.freeze(node), { sealed: true, frozen: true, extensible: false }]
		])("%s on an array node that also holds a member reaches the module's array too", async (_name, op, expected) => {
			op(api.lst);
			expect(await api.lst.state()).toEqual(expected);
		});

		it("a symbol member a custom array prototype supplies reads, as on the array", () => {
			const symTag = Symbol.for("slothlet.test.protoTag");
			expect(api.box.symList[symTag].v).toBe(1);
		});

		it("an index defined without `configurable` is reported non-configurable, as on the array", () => {
			const list = api.box.defList;
			Object.defineProperty(list, "7", { value: 1, enumerable: true, writable: true });
			expect(Object.getOwnPropertyDescriptor(list, "7").configurable).toBe(false);
			expect(Reflect.deleteProperty(list, "7")).toBe(false);
		});

		it("a read-only length on a composed array's module array is reported as read-only", () => {
			expect(Object.getOwnPropertyDescriptor(api.lst2, "length").writable).toBe(false);
		});

		it("an index defined on a composed array node reaches the module's array", async () => {
			Object.defineProperty(api.lst, "0", { value: 9, writable: true, enumerable: true, configurable: true });
			expect(await api.lst.first()).toBe(9);
			expect(api.lst[0]).toBe(9);
		});
	}
);
