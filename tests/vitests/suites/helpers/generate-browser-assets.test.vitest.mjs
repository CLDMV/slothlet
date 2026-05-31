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
});

describe("generateManifest still returns the bare manifest", () => {
	it("returns { files, directories } with no importmap", async () => {
		const manifest = await generateManifest(API_DIR);
		expect(manifest).toHaveProperty("files");
		expect(manifest).toHaveProperty("directories");
		expect(manifest).not.toHaveProperty("importmap");
	});
});
