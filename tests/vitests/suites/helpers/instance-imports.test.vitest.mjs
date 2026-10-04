/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/instance-imports.test.vitest.mjs
 *	@Date: 2026-09-28T21:41:18-07:00 (1790656878)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:05-07:00 (1791090905)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unit tests for the per-instance helper-import rule (#518): which imports carry a
 * leaf's instance query, the Node resolve-hook registration, and the vite plugin.
 */

import { describe, it, expect } from "vitest";
import {
	INSTANCE_QUERY_KEYS,
	isFileSpecifier,
	isInstanceScopedFile,
	propagateInstanceQuery,
	installInstanceImportHooks,
	slothletInstanceImports
} from "@cldmv/slothlet/helpers/instance-imports";

const LEAF = "file:///app/api/tally/tally.mjs?slothlet_instance=abc";
const OWN_LIB = new URL("../../../../src/lib/", import.meta.url).href;

describe("Helpers > instance-imports (#518)", () => {
	describe("isFileSpecifier", () => {
		it("accepts relative, absolute and file: specifiers", () => {
			expect(isFileSpecifier("./x.mjs")).toBe(true);
			expect(isFileSpecifier("../x.mjs")).toBe(true);
			expect(isFileSpecifier("/abs/x.mjs")).toBe(true);
			expect(isFileSpecifier("file:///abs/x.mjs")).toBe(true);
		});

		it("rejects bare, builtin and subpath-import specifiers", () => {
			expect(isFileSpecifier("acorn")).toBe(false);
			expect(isFileSpecifier("@cldmv/slothlet/runtime")).toBe(false);
			expect(isFileSpecifier("node:path")).toBe(false);
			expect(isFileSpecifier("#lib/state")).toBe(false);
			expect(isFileSpecifier(undefined)).toBe(false);
		});
	});

	describe("isInstanceScopedFile", () => {
		it("scopes files outside node_modules", () => {
			expect(isInstanceScopedFile("file:///app/lib/state.mjs", LEAF)).toBe(true);
			expect(isInstanceScopedFile("/app/lib/state.mjs?x=1#h", "/app/api/tally.mjs")).toBe(true);
		});

		it("normalizes Windows separators", () => {
			expect(isInstanceScopedFile("C:\\app\\lib\\state.cjs", "C:\\app\\api\\leaf.cjs")).toBe(true);
			expect(isInstanceScopedFile("C:\\app\\node_modules\\x\\index.js", "C:\\app\\api\\leaf.cjs")).toBe(false);
		});

		it("keeps another node_modules package shared", () => {
			expect(isInstanceScopedFile("file:///app/node_modules/acorn/dist/acorn.mjs", LEAF)).toBe(false);
			expect(isInstanceScopedFile("/app/node_modules/@scope/pkg/index.js", "/app/node_modules/@scope/other/api/x.mjs")).toBe(false);
		});

		it("scopes a node_modules package's own helpers when the importer lives in that package", () => {
			const leaf = "file:///app/node_modules/@org/plugin/dist/api/leaf.mjs?slothlet_instance=abc";
			expect(isInstanceScopedFile("file:///app/node_modules/@org/plugin/dist/lib/state.mjs", leaf)).toBe(true);
			expect(isInstanceScopedFile("/app/node_modules/plain/lib/a.js", "/app/node_modules/plain/api/b.js")).toBe(true);
		});

		it("never scopes slothlet's own files", () => {
			expect(isInstanceScopedFile(`${OWN_LIB}runtime/runtime.mjs`, LEAF)).toBe(false);
			expect(isInstanceScopedFile(new URL("../../../../index.mjs", import.meta.url).href, LEAF)).toBe(false);
			expect(isInstanceScopedFile(decodeURIComponent(new URL("../../../../index.cjs", import.meta.url).pathname), LEAF)).toBe(false);
		});
	});

	describe("propagateInstanceQuery", () => {
		it("copies only the instance key from the parent, not the mount or reload stamp", () => {
			const parent = "file:///app/api/a.mjs?slothlet_instance=abc&module=m1&_reload=42&other=1";
			const out = propagateInstanceQuery("../lib/s.mjs", parent, "file:///app/lib/s.mjs");
			const params = new URL(out).searchParams;
			for (const key of INSTANCE_QUERY_KEYS) expect(params.has(key)).toBe(true);
			expect(params.get("slothlet_instance")).toBe("abc");
			// The partial-reload stamp is not copied: helpers keep the instance copy across partial reloads.
			expect(params.has("_reload")).toBe(false);
			expect(params.has("other")).toBe(false);
			// The mount identity is not copied: a helper is one copy per instance across every mount.
			expect(params.has("module")).toBe(false);
			expect(INSTANCE_QUERY_KEYS).toEqual(["slothlet_instance"]);
		});

		it("keeps an existing child query and hash", () => {
			expect(propagateInstanceQuery("./s.mjs?v=1#frag", LEAF, "file:///app/api/tally/s.mjs?v=1#frag")).toBe(
				"file:///app/api/tally/s.mjs?v=1&slothlet_instance=abc#frag"
			);
			expect(propagateInstanceQuery("./s.mjs#frag", LEAF, "file:///app/api/tally/s.mjs#frag")).toBe(
				"file:///app/api/tally/s.mjs?slothlet_instance=abc#frag"
			);
		});

		it("works on vite ids (absolute paths)", () => {
			expect(propagateInstanceQuery("../lib/s.mjs", "/app/api/a.mjs?slothlet_instance=abc", "/app/lib/s.mjs")).toBe(
				"/app/lib/s.mjs?slothlet_instance=abc"
			);
			expect(propagateInstanceQuery("../lib/s.mjs", "C:/app/api/a.mjs?slothlet_instance=abc", "C:/app/lib/s.mjs")).toBe(
				"C:/app/lib/s.mjs?slothlet_instance=abc"
			);
		});

		it("leaves the child alone when the rule does not apply", () => {
			// No slothlet query on the parent.
			expect(propagateInstanceQuery("./s.mjs", "file:///app/x.mjs", "file:///app/s.mjs")).toBe("file:///app/s.mjs");
			expect(propagateInstanceQuery("./s.mjs", undefined, "file:///app/s.mjs")).toBe("file:///app/s.mjs");
			// Bare specifier.
			expect(propagateInstanceQuery("acorn", LEAF, "file:///app/node_modules/acorn/x.mjs")).toBe("file:///app/node_modules/acorn/x.mjs");
			// Non-file results.
			expect(propagateInstanceQuery("./s.mjs", LEAF, "data:text/javascript,1")).toBe("data:text/javascript,1");
			expect(propagateInstanceQuery("./s.mjs", LEAF, undefined)).toBe(undefined);
			// Already carries an instance query.
			const tagged = "file:///app/s.mjs?slothlet_instance=other";
			expect(propagateInstanceQuery("./s.mjs", LEAF, tagged)).toBe(tagged);
			// Relative path into another package.
			const pkg = "file:///app/node_modules/x/index.mjs";
			expect(propagateInstanceQuery("../../node_modules/x/index.mjs", LEAF, pkg)).toBe(pkg);
		});
	});

	describe("installInstanceImportHooks", () => {
		it("prefers registerHooks and registers once per registry", () => {
			const calls = [];
			const nodeModule = { registerHooks: (hooks) => calls.push(hooks), register: () => calls.push("register") };
			const registry = {};
			expect(installInstanceImportHooks(nodeModule, registry)).toBe(true);
			expect(installInstanceImportHooks(nodeModule, registry)).toBe(true);
			expect(calls).toHaveLength(1);
			const next = (specifier) => ({ url: `file:///app/lib/${specifier.split("/").pop()}` });
			expect(calls[0].resolve("../lib/s.mjs", { parentURL: LEAF }, next).url).toBe("file:///app/lib/s.mjs?slothlet_instance=abc");
		});

		it("never falls back to the off-thread module.register", () => {
			const urls = [];
			expect(installInstanceImportHooks({ register: (u) => urls.push(u) }, {})).toBe(false);
			expect(urls).toHaveLength(0);
		});

		it("returns false on a host with neither API", () => {
			const registry = {};
			expect(installInstanceImportHooks({}, registry)).toBe(false);
			expect(installInstanceImportHooks(undefined, registry)).toBe(false);
		});
	});

	describe("slothletInstanceImports (vite plugin)", () => {
		const plugin = slothletInstanceImports();

		it("is a pre-enforced resolveId plugin", () => {
			expect(plugin.name).toBe("slothlet-instance-imports");
			expect(plugin.enforce).toBe("pre");
		});

		it("adds the importer's instance query to a relative import", async () => {
			const ctx = { resolve: async (source, importer, options) => ({ id: "/app/lib/s.mjs", seen: options }) };
			const out = await plugin.resolveId.call(ctx, "../lib/s.mjs", "/app/api/a.mjs?slothlet_instance=abc", { ssr: true });
			expect(out.id).toBe("/app/lib/s.mjs?slothlet_instance=abc");
			expect(out.seen).toEqual({ ssr: true, skipSelf: true });
		});

		it("defers when the rule does not apply", async () => {
			const ctx = {
				resolve: async () => {
					throw new Error("must not resolve");
				}
			};
			expect(await plugin.resolveId.call(ctx, "./s.mjs", undefined, {})).toBe(null);
			expect(await plugin.resolveId.call(ctx, "./s.mjs", "/app/api/a.mjs", {})).toBe(null);
			expect(await plugin.resolveId.call(ctx, "acorn", "/app/api/a.mjs?slothlet_instance=abc", {})).toBe(null);
		});

		it("returns unresolved, external and non-scoped resolutions unchanged", async () => {
			const importer = "/app/api/a.mjs?slothlet_instance=abc";
			expect(await plugin.resolveId.call({ resolve: async () => null }, "./s.mjs", importer, {})).toBe(null);
			const external = { id: "/app/s.mjs", external: true };
			expect(await plugin.resolveId.call({ resolve: async () => external }, "./s.mjs", importer, {})).toBe(external);
			const pkg = { id: "/app/node_modules/x/index.mjs" };
			expect(await plugin.resolveId.call({ resolve: async () => pkg }, "../node_modules/x/index.mjs", importer, {})).toBe(pkg);
		});
	});
});
