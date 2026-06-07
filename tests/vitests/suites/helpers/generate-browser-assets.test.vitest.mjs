/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/generate-browser-assets.test.vitest.mjs
 *	@Date: 2026-05-31T08:04:06-07:00 (1780239846)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:18:06 -07:00 (1780546686)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for generateBrowserAssets / generateImportMap (#123 browser importmap).
 *
 * @description
 * Covers the one-call browser-asset generator: it returns both the API manifest and slothlet's
 * own importmap, with the importmap rebased onto a configurable `slothletBase` (default the
 * conventional node_modules location). Verifies the default, overrides, the string guard, the
 * i18n locale enumeration, and that `generateManifest` still returns the bare manifest.
 *
 * @module tests/vitests/suites/helpers/generate-browser-assets.test.vitest
 */

import { describe, it, expect } from "vitest";
import { generateBrowserAssets, generateImportMap, generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";

const API_DIR = "api_tests/api_test_browser";

describe("generateBrowserAssets (#123)", () => {
	it("returns both the API manifest and slothlet's own importmap", async () => {
		const { manifest, importmap } = await generateBrowserAssets(API_DIR);

		// Manifest is the API-directory tree.
		expect(Array.isArray(manifest.files)).toBe(true);
		expect(Array.isArray(manifest.directories)).toBe(true);
		expect(manifest.files.length).toBeGreaterThan(0);

		// Importmap covers slothlet's own modules.
		expect(importmap.imports["@cldmv/slothlet"]).toBeDefined();
		expect(importmap.imports["@cldmv/slothlet/helpers/config"]).toBeDefined();
		// Every entry is a real module/locale URL.
		for (const url of Object.values(importmap.imports)) {
			expect(url.endsWith(".mjs") || url.endsWith(".json")).toBe(true);
		}
	});

	it("defaults slothletBase to the conventional node_modules location", async () => {
		const { importmap } = await generateBrowserAssets(API_DIR);
		expect(importmap.imports["@cldmv/slothlet"]).toMatch(/^\/node_modules\/@cldmv\/slothlet\//);
	});

	it("rebases every entry onto an explicit slothletBase ('/')", async () => {
		const { importmap } = await generateBrowserAssets(API_DIR, { slothletBase: "/" });
		expect(importmap.imports["@cldmv/slothlet"]).toBe("/index.mjs");
		for (const url of Object.values(importmap.imports)) {
			expect(url.startsWith("/")).toBe(true);
			expect(url.startsWith("/node_modules/")).toBe(false);
		}
	});

	it("rebases onto a CDN base and normalizes a missing trailing slash", async () => {
		const base = "https://cdn.example.com/@cldmv/slothlet@3"; // no trailing slash
		const { importmap } = await generateBrowserAssets(API_DIR, { slothletBase: base });
		expect(importmap.imports["@cldmv/slothlet"]).toBe(`${base}/index.mjs`);
	});

	it("includes every shipped i18n locale", async () => {
		const { importmap } = await generateBrowserAssets(API_DIR, { slothletBase: "/" });
		const locales = Object.keys(importmap.imports).filter((k) => k.startsWith("@cldmv/slothlet/i18n/language/"));
		expect(locales.length).toBeGreaterThanOrEqual(10);
		expect(importmap.imports["@cldmv/slothlet/i18n/language/en-us.json"]).toMatch(/en-us\.json$/);
	});

	it("throws when slothletBase is provided but not a string", async () => {
		await expect(generateBrowserAssets(API_DIR, { slothletBase: 42 })).rejects.toThrow(/slothletBase must be a string/);
	});
});

describe("generateImportMap (#123)", () => {
	it("uses the default base when none is passed", async () => {
		const { imports } = await generateImportMap();
		expect(imports["@cldmv/slothlet"]).toMatch(/^\/node_modules\/@cldmv\/slothlet\//);
	});

	it("rebases onto an explicit base", async () => {
		const { imports } = await generateImportMap("/vendor/slothlet/");
		expect(imports["@cldmv/slothlet"]).toBe("/vendor/slothlet/index.mjs");
	});

	it("maps every public module export — flat and per-file wildcard — so no browser endpoint 404s (#137)", async () => {
		const { readFileSync, readdirSync } = await import("node:fs");
		const pkg = JSON.parse(readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"));
		const { imports } = await generateImportMap("/");

		// (a) Every flat (non-wildcard) module export resolves — including the bare runtime aggregator,
		// which slothlet's internals never import directly. The JSON schema export is tooling-only (not a
		// browser module), so it is excluded by design.
		const flat = Object.keys(pkg.exports)
			.filter((k) => !k.includes("*") && !k.endsWith(".json"))
			.map((k) => (k === "." ? "@cldmv/slothlet" : `@cldmv/slothlet${k.slice(1)}`));
		expect(flat.filter((spec) => !(spec in imports))).toEqual([]);
		expect(imports["@cldmv/slothlet/runtime"]).toMatch(/\.mjs$/);

		// (b) Every FILE under each wildcard module export must have its own entry, so a browser can
		// resolve any wildcard endpoint — not just the modules slothlet itself imports. Enumerate the
		// source directory each wildcard export declares (the authoritative module list) and require coverage.
		const repoRoot = new URL("../../../../", import.meta.url);
		const listMjs = (dirUrl, prefix = "") => {
			const out = [];
			for (const e of readdirSync(dirUrl, { withFileTypes: true })) {
				if (e.isDirectory()) out.push(...listMjs(new URL(`${e.name}/`, dirUrl), `${prefix}${e.name}/`));
				else if (e.name.endsWith(".mjs")) out.push(`${prefix}${e.name.slice(0, -4)}`);
			}
			return out;
		};
		const wildcardMissing = [];
		for (const [key, value] of Object.entries(pkg.exports)) {
			if (!key.includes("*") || key.startsWith("./i18n/language/")) continue;
			const specPrefix = `@cldmv/slothlet${key.slice(1)}`.split("*")[0];
			const srcTmpl = JSON.stringify(value).match(/\.\/src\/[^"*]*\*\.mjs/)?.[0];
			if (!srcTmpl) continue; // no dev/src target declared for this export
			const dirRel = srcTmpl.slice(2, srcTmpl.indexOf("*")); // e.g. "src/lib/helpers/"
			for (const name of listMjs(new URL(dirRel, repoRoot))) {
				if (!(specPrefix + name in imports)) wildcardMissing.push(specPrefix + name);
			}
		}
		// Guard against a no-op: we must have actually enumerated real wildcard modules.
		expect(imports["@cldmv/slothlet/helpers/config"]).toMatch(/\.mjs$/);
		expect(wildcardMissing).toEqual([]);
	});
});

describe("generateManifest still returns the bare manifest", () => {
	it("returns { files, directories } with no importmap", async () => {
		const manifest = await generateManifest(API_DIR);
		expect(manifest).toHaveProperty("files");
		expect(manifest).toHaveProperty("directories");
		expect(manifest).not.toHaveProperty("importmap");
	});
});
