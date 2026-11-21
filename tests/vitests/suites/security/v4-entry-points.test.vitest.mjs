/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/security/v4-entry-points.test.vitest.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:31:03-08:00 (1794882663)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The v4 package surface: slothlet's internals left `exports` for package-private `imports`
 * (`#builders/*`, `#helpers/*`, `#modes/*`, `#processors/*`, `#slothlet`), and three entry points took the public
 * pieces they held: `@cldmv/slothlet/vite` (the vite / vitest plugin), `@cldmv/slothlet/files` (the browser file list,
 * importmap and resolver) and `@cldmv/slothlet/sanitize`. `SlothletDebug` is no longer exported from `/errors`.
 * @module tests/vitests/suites/security/v4-entry-points
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { generateManifest } from "#helpers/generate-manifest";
import { createManifestResolver } from "#helpers/manifest-resolver";
import { sanitizePropertyName } from "#helpers/sanitize";
import { slothletInstanceImports } from "#helpers/instance-imports";

// Built at runtime so the module runner cannot resolve (and reject) them while transforming this file.
const subpath = (...parts) => parts.join("/");

const API_DIR = "api_tests/api_test_browser";

describe("v4 entry points > internal subpaths left exports", () => {
	it.each([
		["helpers", "sanitize"],
		["helpers", "generate-manifest"],
		["helpers", "manifest-resolver"],
		["helpers", "instance-imports"],
		["builders", "builder"],
		["modes", "eager"],
		["processors", "loader"]
	])("@cldmv/slothlet/%s/%s is not exported", async (dir, name) => {
		await expect(import(/* @vite-ignore */ subpath("@cldmv/slothlet", dir, name))).rejects.toThrow(
			/not exported|ERR_PACKAGE_PATH_NOT_EXPORTED/
		);
	});

	it("@cldmv/slothlet/slothlet is not exported", async () => {
		await expect(import(/* @vite-ignore */ subpath("@cldmv/slothlet", "slothlet"))).rejects.toThrow(
			/not exported|ERR_PACKAGE_PATH_NOT_EXPORTED/
		);
	});

	it("@cldmv/slothlet/errors exports the two error classes and not the debug logger", async () => {
		const errors = await import("@cldmv/slothlet/errors");
		expect(Object.keys(errors).sort()).toEqual(["SlothletError", "SlothletWarning"]);
	});
});

describe("v4 entry points > @cldmv/slothlet/vite", () => {
	it("exports only `plugin`, the vite plugin", async () => {
		const vite = await import("@cldmv/slothlet/vite");
		expect(Object.keys(vite)).toEqual(["plugin"]);
		expect(vite.plugin).toBe(slothletInstanceImports);
		expect(vite.plugin().name).toBe("slothlet-instance-imports");
	});
});

describe("v4 entry points > @cldmv/slothlet/sanitize", () => {
	it("exports only `sanitize`, the property-name sanitizer", async () => {
		const mod = await import("@cldmv/slothlet/sanitize");
		expect(Object.keys(mod)).toEqual(["sanitize"]);
		expect(mod.sanitize).toBe(sanitizePropertyName);
		expect(mod.sanitize("my-file")).toBe("myFile");
	});
});

describe("v4 entry points > @cldmv/slothlet/files", () => {
	afterEach(() => {
		vi.doUnmock("#helpers/platform");
		vi.resetModules();
	});

	it("exports one frozen `files` namespace", async () => {
		const mod = await import("@cldmv/slothlet/files");
		expect(Object.keys(mod)).toEqual(["files"]);
		const { files } = mod;
		expect(Object.keys(files).sort()).toEqual(["assets", "generate", "importmap", "resolver", "specifiers"]);
		expect(Object.keys(files.specifiers).sort()).toEqual(["packages", "slothlet"]);
		expect(Object.isFrozen(files)).toBe(true);
		expect(Object.isFrozen(files.specifiers)).toBe(true);
		expect(files.resolver).toBe(createManifestResolver);
	});

	it("runs the Node functions in Node", async () => {
		const { files } = await import("@cldmv/slothlet/files");
		expect(await files.generate(API_DIR)).toEqual(await generateManifest(API_DIR));
		const { manifest, importmap } = await files.assets(API_DIR, { base: "/" });
		expect(manifest).toEqual(await generateManifest(API_DIR));
		expect(importmap.imports["@cldmv/slothlet/files"]).toMatch(/files\.mjs$/);
		expect((await files.importmap("/")).imports["@cldmv/slothlet"]).toBe("/index.mjs");
		expect((await files.specifiers.slothlet(process.cwd())).has("#helpers/config")).toBe(true);
		expect((await files.specifiers.packages(process.cwd())).get("@cldmv/slothlet/files")).toMatch(/files\.mjs$/);
	});

	it("refuses the Node functions outside Node, and still hands out the resolver", async () => {
		vi.resetModules();
		vi.doMock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), isNode: false }));
		const { files } = await import("@cldmv/slothlet/files");
		for (const [name, call] of [
			[["files", "generate"], () => files.generate(API_DIR)],
			[["files", "importmap"], () => files.importmap("/")],
			[["files", "assets"], () => files.assets(API_DIR)],
			[["files", "specifiers", "slothlet"], () => files.specifiers.slothlet(process.cwd())],
			[["files", "specifiers", "packages"], () => files.specifiers.packages(process.cwd())]
		]) {
			const error = await call().then(
				() => null,
				(e) => e
			);
			expect([name, error?.code, error?.details?.operation]).toEqual([name, "FILES_REQUIRES_NODE", name]);
		}
		expect(files.resolver("https://example.com/api/")({ path: "math.mjs" })).toBe("https://example.com/api/math.mjs");
	});
});
