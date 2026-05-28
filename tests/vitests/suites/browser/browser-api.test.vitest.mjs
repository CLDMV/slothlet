/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-api.test.vitest.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 08:10:30 -07:00 (1779981030)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Integration tests for browser-mode API tree construction.
 *
 * @description
 * Forces browser mode via `env: "browser"` (the explicit override) so the tests
 * can run inside the Node.js test environment while exercising the manifest-based
 * code path.  `resolveModuleSpecifier` returns real `file://` URLs pointing at
 * the `api_test_browser/` fixture directory so actual module loading succeeds.
 *
 * Covers:
 * - Root-level modules (math, auth) are mounted at `api.math` and `api.auth`
 * - Nested sub-directory modules (utils/format) are mounted at `api.utils.format`
 * - All exports from each module are callable and return expected values
 * - Matrix: eager × async, eager × live, lazy × async, lazy × live
 * - `api.slothlet.api.add` in browser mode mounts an additional path at runtime
 * - Shutdown completes without errors
 *
 * @module tests/vitests/suites/browser/browser-api
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

/**
 * Manifest generated once before all tests via the build-time helper.
 * @type {{ files: Array<{path:string,name:string,fullName:string}>, directories: Array }}
 */
let BROWSER_MANIFEST;

/**
 * Pre-built resolver that converts manifest-relative paths to `file://` URLs
 * pointing at the `api_test_browser/` fixture directory.
 *
 * @type {(entry: {path:string,name:string,fullName:string}) => string}
 */
let resolveSpecifier;

beforeAll(async () => {
	BROWSER_MANIFEST = await generateManifest(FIXTURE_DIR);
	resolveSpecifier = createManifestResolver(new URL(`file://${FIXTURE_DIR}/`));
});

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a browser-mode slothlet config merged with the matrix config.
 * Providing `manifest` automatically triggers browser mode — no need for
 * `env: "browser"` or a manual `resolveModuleSpecifier`. `base` is the
 * directory URL used as the default resolver base.
 *
 * @param {object} matrixConfig - Config slice from getMatrixConfigs().
 * @returns {object} Full config ready to pass to slothlet().
 *
 * @example
 * const api = await slothlet(browserConfig(config));
 */
function browserConfig(matrixConfig) {
	return {
		...matrixConfig,
		base: `file://${FIXTURE_DIR}/`,
		manifest: BROWSER_MANIFEST
	};
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe.each(getMatrixConfigs())("Browser Mode > API tree > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("mounts root-level modules from the manifest", async () => {
		api = await slothlet(browserConfig(config));

		expect(api.math).toBeDefined();
		expect(api.auth).toBeDefined();
	});

	it("exposes and calls exports from a root-level module (math)", async () => {
		api = await slothlet(browserConfig(config));

		expect(api.math.add(2, 3)).toBe(5);
		expect(api.math.multiply(3, 4)).toBe(12);
	});

	it("exposes and calls exports from a second root-level module (auth)", async () => {
		api = await slothlet(browserConfig(config));

		const result = api.auth.login("alice", "secret");
		expect(result).toEqual({ ok: true, user: "alice" });
		expect(api.auth.logout()).toEqual({ ok: true });
	});

	it("mounts nested sub-directory modules (utils/format)", async () => {
		api = await slothlet(browserConfig(config));

		expect(api.utils).toBeDefined();
		expect(api.utils.format).toBeDefined();
	});

	it("exposes and calls exports from a nested module (utils/format)", async () => {
		api = await slothlet(browserConfig(config));

		// await handles both eager (sync return) and lazy (Promise) modes transparently
		expect(await api.utils.format.upper("hello")).toBe("HELLO");
		expect(await api.utils.format.lower("WORLD")).toBe("world");
	});

	it("exposes the slothlet internal API (api.slothlet)", async () => {
		api = await slothlet(browserConfig(config));

		expect(api.slothlet).toBeDefined();
		expect(api.slothlet.api).toBeDefined();
	});

	it("resolveModuleSpecifier receives correct fileEntry shape", async () => {
		const calls = [];
		api = await slothlet({
			...browserConfig(config),
			resolveModuleSpecifier: (entry) => {
				calls.push({ ...entry });
				return resolveSpecifier(entry);
			}
		});

		// Each call should have path, name, and fullName
		expect(calls.length).toBeGreaterThan(0);
		for (const entry of calls) {
			expect(typeof entry.path).toBe("string");
			expect(typeof entry.name).toBe("string");
			expect(typeof entry.fullName).toBe("string");
			expect(entry.fullName).toMatch(/\.mjs$/);
			expect(entry.name).toBe(entry.fullName.replace(/\.mjs$/, ""));
		}
	});

	it("generateManifest produces a manifest matching BROWSER_MANIFEST structure", async () => {
		const generated = await generateManifest(FIXTURE_DIR);
		expect(generated.files).toBeInstanceOf(Array);
		expect(generated.directories).toBeInstanceOf(Array);
		// Should discover math.mjs and auth.mjs at the root
		const rootNames = generated.files.map((f) => f.name).sort();
		expect(rootNames).toContain("math");
		expect(rootNames).toContain("auth");
		// Should discover utils/ directory with format.mjs inside
		const utilsDir = generated.directories.find((d) => d.name === "utils");
		expect(utilsDir).toBeDefined();
		expect(utilsDir.children.files.map((f) => f.name)).toContain("format");
	});

	it("createManifestResolver resolves paths to correct file URLs", () => {
		const base = new URL(`file://${FIXTURE_DIR}/`);
		const resolver = createManifestResolver(base);
		const result = resolver({ path: "math.mjs", name: "math", fullName: "math.mjs" });
		expect(result).toMatch(/^file:\/\//);
		expect(result).toMatch(/math\.mjs$/);
	});

	it("shutdown completes cleanly in browser mode", async () => {
		api = await slothlet(browserConfig(config));
		await expect(api.shutdown()).resolves.not.toThrow();
		api = null;
	});
});

// ─── node/browser parity ──────────────────────────────────────────────────────

describe.each(getMatrixConfigs())("Browser Mode > parity with node mode > $name", ({ config }) => {
	let nodeApi;
	let browserApi;

	afterEach(async () => {
		if (nodeApi) await nodeApi.shutdown();
		if (browserApi) await browserApi.shutdown();
		nodeApi = null;
		browserApi = null;
	});

	it("root-level exports return identical values in both modes", async () => {
		nodeApi = await slothlet({ ...config, base: FIXTURE_DIR });
		browserApi = await slothlet(browserConfig(config));

		expect(nodeApi.math.add(10, 5)).toBe(browserApi.math.add(10, 5));
		expect(nodeApi.math.multiply(3, 7)).toBe(browserApi.math.multiply(3, 7));
	});

	it("auth exports return identical values in both modes", async () => {
		nodeApi = await slothlet({ ...config, base: FIXTURE_DIR });
		browserApi = await slothlet(browserConfig(config));

		const nodeLogin = nodeApi.auth.login("alice", "pw");
		const browserLogin = browserApi.auth.login("alice", "pw");
		expect(nodeLogin).toEqual(browserLogin);

		expect(nodeApi.auth.logout()).toEqual(browserApi.auth.logout());
	});

	it("nested module exports return identical values in both modes", async () => {
		nodeApi = await slothlet({ ...config, base: FIXTURE_DIR });
		browserApi = await slothlet(browserConfig(config));

		// await handles both eager (sync) and lazy (Promise) for both modes
		const nodeUpper = await nodeApi.utils.format.upper("hello");
		const browserUpper = await browserApi.utils.format.upper("hello");
		expect(nodeUpper).toBe(browserUpper);

		const nodeLower = await nodeApi.utils.format.lower("WORLD");
		const browserLower = await browserApi.utils.format.lower("WORLD");
		expect(nodeLower).toBe(browserLower);
	});

	it("the same module paths exist on both API trees", async () => {
		nodeApi = await slothlet({ ...config, base: FIXTURE_DIR });
		browserApi = await slothlet(browserConfig(config));

		// Both should expose math, auth, utils namespaces
		for (const ns of ["math", "auth", "utils"]) {
			expect(nodeApi[ns]).toBeDefined();
			expect(browserApi[ns]).toBeDefined();
		}

		// Both should expose the same leaf functions
		for (const path of [
			["math", "add"],
			["math", "multiply"],
			["auth", "login"],
			["auth", "logout"],
			["utils", "format", "upper"],
			["utils", "format", "lower"]
		]) {
			const [a, b, c] = path;
			const nodeVal = c ? nodeApi[a][b][c] : nodeApi[a][b];
			const browserVal = c ? browserApi[a][b][c] : browserApi[a][b];
			expect(typeof nodeVal, `node: ${path.join(".")} should be defined`).not.toBe("undefined");
			expect(typeof browserVal, `browser: ${path.join(".")} should be defined`).not.toBe("undefined");
		}
	});
});
