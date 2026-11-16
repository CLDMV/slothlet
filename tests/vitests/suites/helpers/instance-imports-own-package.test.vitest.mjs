/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/instance-imports-own-package.test.vitest.mjs
 *	@Date: 2026-11-08T16:51:36-08:00 (1794185496)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:58:40-08:00 (1794185920)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unit tests for the bare-specifier half of the per-instance helper rule (#715): a bare specifier that
 * resolves into the importing leaf's own package (`#imports`, a self-reference by name) carries the leaf's instance
 * query as a relative import of the same file does, and a `require()` of it from an instance's CommonJS code is served
 * the instance's copy as a relative require is; one that resolves into another package, a builtin, or slothlet's own
 * tree does not.
 */

import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	installInstanceImportHooks,
	isOwnPackageImport,
	propagateInstanceQuery,
	requireInInstance,
	releaseInstanceScope,
	slothletInstanceImports
} from "@cldmv/slothlet/helpers/instance-imports";

const OWN_SRC = new URL("../../../../src/", import.meta.url).pathname;
const MARK = "?slothlet_instance=abc";

// Made when the file is collected, as the cases below read the paths while they are being declared.
const base = fs.mkdtempSync(path.join(os.tmpdir(), "slothlet-715-own-")).replaceAll("\\", "/");
const pkg = `${base}/pkg`;
fs.mkdirSync(`${pkg}/api/a`, { recursive: true });
fs.writeFileSync(`${pkg}/package.json`, JSON.stringify({ name: "own-pkg", imports: { "#h": "./lib/h.mjs" } }));
// The CommonJS leaf: its only statement calls the function a test leaves on the global object, so the test runs while
// the leaf's scope is active.
fs.writeFileSync(`${pkg}/api/a/a.cjs`, 'module.exports = globalThis[Symbol.for("slothlet.test.inScope")]();');
// A package directory under `node_modules` with no manifest of its own.
const installed = `${base}/node_modules/bare-dir`;
fs.mkdirSync(installed, { recursive: true });

afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

describe("Helpers > instance-imports > bare specifiers into the leaf's own package (#715)", () => {
	describe("isOwnPackageImport", () => {
		it("is true for a file of the importer's own package", () => {
			expect(isOwnPackageImport(`${pkg}/lib/h.mjs`, `file://${pkg}/api/a/a.mjs${MARK}`)).toBe(true);
		});

		it("is false for a file of another package, and for slothlet's own tree", () => {
			expect(isOwnPackageImport(`${base}/node_modules/x/index.mjs`, `${pkg}/api/a/a.mjs`)).toBe(false);
			expect(isOwnPackageImport(`${OWN_SRC}slothlet.mjs`, `${OWN_SRC}../api_tests/x/x.mjs`)).toBe(false);
		});
	});

	describe("propagateInstanceQuery", () => {
		const leaf = `file://${pkg}/api/a/a.mjs${MARK}`;

		it("tags `#imports` and a self-reference that resolve into the leaf's own package", () => {
			expect(propagateInstanceQuery("#h", leaf, `file://${pkg}/lib/h.mjs`)).toBe(`file://${pkg}/lib/h.mjs${MARK}`);
			expect(propagateInstanceQuery("own-pkg/h", leaf, `file://${pkg}/lib/h.mjs`)).toBe(`file://${pkg}/lib/h.mjs${MARK}`);
		});

		it("leaves a bare specifier into another package, a builtin and a missing specifier as they are", () => {
			expect(propagateInstanceQuery("x", leaf, `file://${base}/node_modules/x/index.mjs`)).toBe(`file://${base}/node_modules/x/index.mjs`);
			expect(propagateInstanceQuery("node:fs", leaf, "node:fs")).toBe("node:fs");
			expect(propagateInstanceQuery(undefined, leaf, `file://${pkg}/lib/h.mjs`)).toBe(`file://${pkg}/lib/h.mjs`);
		});

		it("leaves a bare specifier that cannot name the leaf's own package as it is, wherever it resolves", () => {
			expect(propagateInstanceQuery("other-pkg/h", leaf, `file://${pkg}/lib/h.mjs`)).toBe(`file://${pkg}/lib/h.mjs`);
		});
	});

	describe("Node hooks: require() inside an instance's CommonJS scope", () => {
		let hooks;
		installInstanceImportHooks({ registerHooks: (h) => (hooks = h) }, {});
		const parentURL = `file://${pkg}/api/a/a.cjs`;
		const helper = `file://${pkg}/lib/h.mjs`;
		const conditions = new Set(["require", "node"]);
		const at = (url) => () => ({ url });
		/**
		 * Resolve a require with the scope of instance `abc`, anchored at the leaf, active.
		 * @param {string} specifier - The specifier as written.
		 * @param {string} url - What the next hook resolves it to.
		 * @returns {string} The resolved URL.
		 */
		const resolveRequire = (specifier, url) => {
			const key = Symbol.for("slothlet.test.inScope");
			globalThis[key] = () => hooks.resolve(specifier, { parentURL, conditions }, at(url)).url;
			try {
				// Loading the leaf through the instance's private cache makes its scope the active one.
				return requireInInstance(`${pkg}/api/a/a.cjs`, "abc", { fresh: true });
			} finally {
				delete globalThis[key];
				releaseInstanceScope("abc");
			}
		};

		it("marks `#imports` and a self-reference that resolve to an ES module of the leaf's own package, as a relative require", () => {
			const marked = `${helper}?slothlet_instance=abc&slothlet_require=1`;
			expect(resolveRequire("../../lib/h.mjs", helper)).toBe(marked);
			expect(resolveRequire("#h", helper)).toBe(marked);
			expect(resolveRequire("own-pkg/h", helper)).toBe(marked);
		});

		it("leaves a bare require into another package, or one that cannot name the leaf's own package, unmarked", () => {
			const other = `file://${base}/node_modules/x/index.mjs`;
			expect(resolveRequire("x", other)).toBe(other);
			expect(resolveRequire("#x", other)).toBe(other);
			expect(resolveRequire("other-pkg/h", helper)).toBe(helper);
		});
	});

	describe("slothletInstanceImports (vite plugin)", () => {
		const plugin = slothletInstanceImports();
		const leaf = `${pkg}/api/a/a.mjs${MARK}`;
		const resolving = (id) => ({ resolve: async () => ({ id }) });
		const refusing = {
			resolve: async () => {
				throw new Error("must not resolve");
			}
		};

		it("tags `#imports` and a self-reference of an instance file's own package", async () => {
			expect(await plugin.resolveId.call(resolving(`${pkg}/lib/h.mjs`), "#h", leaf, {})).toEqual({ id: `${pkg}/lib/h.mjs${MARK}` });
			expect(await plugin.resolveId.call(resolving(`${pkg}/lib/h.mjs`), "own-pkg/h", leaf, {})).toEqual({ id: `${pkg}/lib/h.mjs${MARK}` });
		});

		it("defers a `#import` that resolves into another package", async () => {
			expect(await plugin.resolveId.call(resolving(`${base}/node_modules/x/index.mjs`), "#h", leaf, {})).toBe(null);
		});

		it("does not resolve a bare specifier that cannot name the instance file's own package", async () => {
			expect(await plugin.resolveId.call(refusing, "other-pkg", leaf, {})).toBe(null);
			expect(await plugin.resolveId.call(refusing, "own-pkg-two", leaf, {})).toBe(null);
			expect(await plugin.resolveId.call(refusing, "bare-dir/x", `${installed}/leaf.mjs${MARK}`, {})).toBe(null);
		});
	});
});
