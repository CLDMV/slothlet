/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/browser/single-file-add.browser.test.mjs
 *	@Date: 2026-11-15T16:54:13-08:00 (1794790453)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:53-08:00 (1795869053)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.api.add()` of a single file in a real headless browser (#805).
 *
 * @description
 * Node mounts one file by scanning its folder with a filter that keeps only that file. A browser has no `node:path`, so
 * the folder, name and extension come from the URL or path string; these rows check that a single-file add mounts,
 * reloads and is refused for a non-module extension there as it is under Node. Expected values come from the fixture
 * files imported plainly in the same page.
 *
 * @module tests/browser/single-file-add.browser
 */

import { describe, it, expect } from "vitest";
// Node-built (filesystem) fixture manifest, injected by the browser config.
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

const configs = ["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime })));

/**
 * The fixture's served base URL, with a trailing slash.
 * @returns {string} The base URL.
 */
const baseUrl = () => new URL("/" + fixtureRel + "/", location.origin).href;

/**
 * Compose the browser fixture in browser mode.
 * @param {object} options - Mode and runtime.
 * @returns {Promise<object>} A bound browser-mode api.
 */
const build = async (options) => {
	const mod = await import("@cldmv/slothlet");
	const slothlet = mod.default ?? mod.slothlet;
	const BASE = baseUrl();
	return slothlet({
		base: BASE,
		loader: {
			platform: "browser",
			files: manifest,
			resolve: ({ path }) => new URL(path, BASE).href
		},
		silent: true,
		...options
	});
};

/**
 * The fixture file imported plainly, the reference for what the add mounts.
 * @param {string} rel - The file's path below the fixture root.
 * @returns {Promise<object>} The module namespace.
 */
const plain = (rel) => import(/* @vite-ignore */ baseUrl() + rel);

/**
 * The code a rejected promise carries, or "resolved".
 * @param {Promise<unknown>} promise - The promise.
 * @returns {Promise<string>} The error's code.
 */
const codeOf = (promise) =>
	promise.then(
		() => "resolved",
		(error) => error?.code ?? String(error)
	);

describe("single-file api.add in a real browser (#805)", () => {
	describe.each(configs)("$mode / $runtime", ({ mode, runtime }) => {
		it("mounts a file at the root of the fixture by its URL, and only that file", async () => {
			const math = await plain("math.mjs");
			const api = await build({ mode, runtime });
			try {
				await api.slothlet.api.add("calc", baseUrl() + "math.mjs");
				expect(await api.calc.add(2, 3)).toBe(math.add(2, 3));
				expect(await api.calc.multiply(4, 5)).toBe(math.multiply(4, 5));
				expect(Object.keys(api.calc).sort()).toEqual(Object.keys(math).sort());
				// The file's siblings in the same folder are not part of this mount.
				expect(api.calc.login).toBeUndefined();
				expect(api.calc.auth).toBeUndefined();
			} finally {
				await api.shutdown();
			}
		});

		it("mounts a file in a subfolder by its URL at a nested path", async () => {
			const format = await plain("utils/format.mjs");
			const api = await build({ mode, runtime });
			try {
				await api.slothlet.api.add(["deep", "fmt"], baseUrl() + "utils/format.mjs");
				expect(await api.deep.fmt.upper("ab")).toBe(format.upper("ab"));
				expect(await api.deep.fmt.lower("CD")).toBe(format.lower("CD"));
				expect(Object.keys(api.deep.fmt).sort()).toEqual(Object.keys(format).sort());
			} finally {
				await api.shutdown();
			}
		});

		it("mounts a file named relative to the fixture root, with or without a leading slash", async () => {
			const math = await plain("math.mjs");
			const format = await plain("utils/format.mjs");
			const api = await build({ mode, runtime });
			try {
				await api.slothlet.api.add("rel", "math.mjs");
				await api.slothlet.api.add("relfmt", "utils/format.mjs");
				await api.slothlet.api.add("slash", "/math.mjs");
				expect(await api.rel.add(1, 1)).toBe(math.add(1, 1));
				expect(await api.slash.multiply(2, 3)).toBe(math.multiply(2, 3));
				expect(await api.relfmt.upper("x")).toBe(format.upper("x"));
			} finally {
				await api.shutdown();
			}
		});

		it("reloads and removes a single-file add by its moduleID", async () => {
			const math = await plain("math.mjs");
			const api = await build({ mode, runtime });
			try {
				await api.slothlet.api.add("calc", baseUrl() + "math.mjs", { id: "calc-file" });
				const held = api.calc;
				await api.slothlet.api.reload("calc-file");
				expect(await api.calc.add(2, 3)).toBe(math.add(2, 3));
				expect(await held.add(2, 3)).toBe(math.add(2, 3));
				expect(Object.keys(api.calc).sort()).toEqual(Object.keys(math).sort());
				await api.slothlet.api.remove("calc-file");
				expect(api.calc).toBeUndefined();
			} finally {
				await api.shutdown();
			}
		});

		it("refuses a file whose extension is not a module's, as Node does", async () => {
			const api = await build({ mode, runtime });
			try {
				expect(await codeOf(api.slothlet.api.add("notes", baseUrl() + "notes.txt"))).toBe("FILE_TYPE_UNSUPPORTED");
				// A name that only starts with a dot has no extension (as `path.extname(".mjs")` answers "").
				expect(await codeOf(api.slothlet.api.add("dot", baseUrl() + ".mjs"))).toBe("FILE_TYPE_UNSUPPORTED");
				expect(api.notes).toBeUndefined();
				expect(api.dot).toBeUndefined();
			} finally {
				await api.shutdown();
			}
		});
	});
});
