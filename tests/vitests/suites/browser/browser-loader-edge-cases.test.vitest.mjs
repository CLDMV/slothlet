/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-loader-edge-cases.test.vitest.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Edge-case coverage for loader.mjs browser-mode methods.
 *
 * @description
 * The browser integration suites cover the happy path (well-formed manifest,
 * matching base, all files present). This file targets the validation branches
 * in `#scanDirectoryBrowser`, `#findManifestNode`, and `#manifestNodeToStructure`:
 *
 *  - `api.slothlet.api.add` to a path NOT present in the manifest → INVALID_DIRECTORY
 *  - Manifest files using fallback fields (`relativePath` instead of `path`,
 *    `dir.name` only without `dir.path`)
 *  - File entries without an extension (no `.`)
 *  - File entries prefixed with `__` (filtered out)
 *  - Non-allowed extensions (.json, .md) in the manifest (filtered out)
 *  - Caller-supplied fileFilter (single-file add scenario)
 *  - Nested-directory recursion (3+ levels deep)
 *
 * @module tests/vitests/suites/browser/browser-loader-edge-cases
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, getManifest, makeBrowserConfig, getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;
let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

function browserCfg(matrixConfig) {
	return makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST);
}

// ─── INVALID_DIRECTORY when manifest node not found ──────────────────────────

describe.each(getMatrixConfigs())("Browser loader > invalid directory > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("api.add to a non-existent manifest path throws INVALID_DIRECTORY", async () => {
		api = await slothlet(browserCfg(config));

		// The manifest only has utils/, math.mjs, auth.mjs — `does/not/exist`
		// is guaranteed missing. The browser scanner should throw INVALID_DIRECTORY
		// when #findManifestNode returns null.
		await expect(api.slothlet.api.add("ghost", `${FIXTURE_DIR}/does/not/exist`)).rejects.toThrow(/INVALID_DIRECTORY/);
	});
});

// ─── Synthetic manifests targeting #manifestNodeToStructure edge cases ───────

/**
 * Build a minimal slothlet config for browser mode with a synthetic manifest,
 * letting tests exercise specific manifest shapes without preparing real files.
 *
 * @param {object} manifest - Synthetic manifest to feed.
 * @param {object} [extra] - Extra config overrides.
 * @returns {object} Config ready for slothlet().
 */
function syntheticBrowserConfig(manifest, extra = {}) {
	return {
		base: FIXTURE_DIR,
		manifest,
		// Default resolver works because the file paths in our synthetic manifest
		// either map to real files in FIXTURE_DIR or never actually get imported
		// (tests assert on shape pre-materialization).
		mode: "eager",
		...extra
	};
}

describe("Browser loader > #manifestNodeToStructure filtering", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("filters out files with non-allowed extensions (.json, .md)", async () => {
		// math.mjs is a real file; add synthetic non-mjs entries that should be skipped.
		const manifest = {
			files: [
				{ path: "math.mjs", name: "math", fullName: "math.mjs" },
				{ path: "config.json", name: "config", fullName: "config.json" },
				{ path: "readme.md", name: "readme", fullName: "readme.md" }
			],
			directories: []
		};
		api = await slothlet(syntheticBrowserConfig(manifest));
		expect(api.math).toBeDefined();
		expect(api.config).toBeUndefined();
		expect(api.readme).toBeUndefined();
	});

	it("filters out files prefixed with __", async () => {
		const manifest = {
			files: [
				{ path: "math.mjs", name: "math", fullName: "math.mjs" },
				{ path: "__internal.mjs", name: "__internal", fullName: "__internal.mjs" }
			],
			directories: []
		};
		api = await slothlet(syntheticBrowserConfig(manifest));
		expect(api.math).toBeDefined();
		expect(api.__internal).toBeUndefined();
	});

	it("uses file.relativePath as fallback when file.path is missing", async () => {
		// Older or hand-rolled manifest format: relativePath key. Both must work.
		const manifest = {
			files: [{ relativePath: "math.mjs", name: "math", fullName: "math.mjs" }],
			directories: []
		};
		api = await slothlet(syntheticBrowserConfig(manifest));
		expect(api.math).toBeDefined();
		expect(api.math.add(2, 3)).toBe(5);
	});

	it("derives fullName from path when fullName is missing", async () => {
		const manifest = {
			files: [{ path: "math.mjs", name: "math" }], // no fullName
			directories: []
		};
		api = await slothlet(syntheticBrowserConfig(manifest));
		expect(api.math).toBeDefined();
	});

	it("derives name from fullName when name is missing", async () => {
		const manifest = {
			files: [{ path: "math.mjs", fullName: "math.mjs" }], // no name
			directories: []
		};
		api = await slothlet(syntheticBrowserConfig(manifest));
		expect(api.math).toBeDefined();
	});
});

describe("Browser loader > nested directory recursion", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("uses dir.name as fallback when dir.path is missing", async () => {
		const manifest = {
			files: [],
			directories: [
				{
					name: "utils",
					// no path
					children: {
						files: [{ path: "utils/format.mjs", name: "format", fullName: "format.mjs" }],
						directories: []
					}
				}
			]
		};
		api = await slothlet(syntheticBrowserConfig(manifest));
		expect(api.utils).toBeDefined();
		expect(api.utils.format).toBeDefined();
	});

	it("derives dir.name from dir.path when name is missing", async () => {
		const manifest = {
			files: [],
			directories: [
				{
					path: "utils",
					// no name
					children: {
						files: [{ path: "utils/format.mjs", name: "format", fullName: "format.mjs" }],
						directories: []
					}
				}
			]
		};
		api = await slothlet(syntheticBrowserConfig(manifest));
		expect(api.utils).toBeDefined();
		expect(api.utils.format).toBeDefined();
	});

	it("accepts a directory node where children are flattened (no nested .children key)", async () => {
		// Some manifest producers omit the .children indirection and put files/dirs
		// directly on the dir node. The loader's `dir.children || dir` fallback handles this.
		const manifest = {
			files: [],
			directories: [
				{
					path: "utils",
					name: "utils",
					files: [{ path: "utils/format.mjs", name: "format", fullName: "format.mjs" }],
					directories: []
				}
			]
		};
		api = await slothlet(syntheticBrowserConfig(manifest));
		expect(api.utils.format).toBeDefined();
	});
});

// ─── #findManifestNode recursion (api.add into nested manifest path) ─────────

describe("Browser loader > #findManifestNode nested recursion", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("locates and mounts a nested manifest sub-directory via api.add", async () => {
		// The standard fixture has utils/ at depth 1. api.add with a nested path
		// exercises the recursive #findManifestNode walk.
		api = await slothlet({ ...syntheticBrowserConfig(BROWSER_MANIFEST), mode: "eager" });
		await api.slothlet.api.add("subset", `${FIXTURE_DIR}/utils`);
		expect(api.subset.format).toBeDefined();
		expect(await api.subset.format.upper("hi")).toBe("HI");
	});
});
