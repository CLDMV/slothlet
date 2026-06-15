/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/leaf-exported-arrays.test.vitest.mjs
 *	@Date: 2026-06-15 00:00:00 -07:00 (1781913600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
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
