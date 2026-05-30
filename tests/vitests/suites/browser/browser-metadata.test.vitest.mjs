/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-metadata.test.vitest.mjs
 *	@Date: 2026-05-30 00:00:00 -07:00 (1748588400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Integration tests for the metadata system in browser mode.
 *
 * @description
 * Browser mode resolves caller identity via wrapper metadata (`____slothletInternal`), not stack traces. The existing Playwright smoke verifies only that `typeof api.slothlet.metadata === "object"` and that `getFor("math.add")` returns an object — it does not assert metadata write/read round-trips, `setGlobal`, or `caller()` from inside a leaf. A regression here would silently break plugin-manifest storage, runtime metadata tagging, and any code that calls `self.slothlet.metadata.caller()` to identify its invoker.
 *
 * Covers (all under `platform:"browser"`, which forces the live runtime via manifest-based loading):
 * - `getFor` returns a plain object for a known path with no metadata set (returns `{}`)
 * - `getFor` returns the correct merged object after `setFor` writes to that path
 * - `setGlobal` (string-key form) is reflected in a subsequent `getFor` call
 * - `setGlobal` (object form) is reflected in a subsequent `getFor` call
 * - path-level `setFor` metadata is inherited by a descendant path via `getFor`
 * - `caller()` called from inside `api.probe.caller()` returns `null` (the test is not a slothlet function — no tracked caller in context)
 * - `getForVersion`: no versioned fixture exists in `api_test_browser`; `getForVersion` on a non-versioned path returns `{}` (the no-version/default path)
 *
 * @module tests/vitests/suites/browser/browser-metadata
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

/**
 * Build a browser-mode config, optionally extending it (e.g. with extra options).
 * @param {object} matrixConfig
 * @param {object} [extra]
 * @returns {object}
 */
function browserCfg(matrixConfig, extra = {}) {
	return { ...makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST), ...extra };
}

describe.each(getMatrixConfigs())("Browser Mode > metadata > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	// ── getFor ──────────────────────────────────────────────────────────────────

	it("getFor returns an object for a known path with no metadata set", async () => {
		api = await slothlet(browserCfg(config));

		const meta = api.slothlet.metadata.getFor("math.add");
		expect(meta).toBeDefined();
		expect(typeof meta).toBe("object");
		expect(meta).not.toBeNull();
		// No metadata has been set — should be an empty object (no system fields; getFor is path-only)
		expect(Object.keys(meta)).toHaveLength(0);
	});

	it("getFor returns {} for a path that does not exist in the fixture", async () => {
		api = await slothlet(browserCfg(config));

		const meta = api.slothlet.metadata.getFor("nonexistent.path.deep");
		expect(meta).toEqual({});
	});

	// ── setFor + getFor round-trip ───────────────────────────────────────────────

	it("setFor write is reflected in a subsequent getFor read", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.metadata.setFor("math", "category", "arithmetic");
		api.slothlet.metadata.setFor("math", "version", "2.0.0");

		const meta = api.slothlet.metadata.getFor("math");
		expect(meta.category).toBe("arithmetic");
		expect(meta.version).toBe("2.0.0");
	});

	it("setFor (object form) write is reflected in a subsequent getFor read", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.metadata.setFor("auth", { role: "gateway", plugin: "auth-core" });

		const meta = api.slothlet.metadata.getFor("auth");
		expect(meta.role).toBe("gateway");
		expect(meta.plugin).toBe("auth-core");
	});

	it("setFor metadata at a parent path is inherited by a descendant via getFor", async () => {
		api = await slothlet(browserCfg(config));

		// Set at the parent "math" — should be visible at "math.add" via ancestor merge
		api.slothlet.metadata.setFor("math", "category", "arithmetic");

		const childMeta = api.slothlet.metadata.getFor("math.add");
		expect(childMeta.category).toBe("arithmetic");
	});

	it("setFor at a child path overrides the parent entry for the same key", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.metadata.setFor("math", { category: "arithmetic", version: "1.0.0" });
		api.slothlet.metadata.setFor("math.add", { version: "2.0.0", specific: true });

		const meta = api.slothlet.metadata.getFor("math.add");
		expect(meta.category).toBe("arithmetic"); // inherited from parent
		expect(meta.version).toBe("2.0.0"); // overridden at child
		expect(meta.specific).toBe(true); // set at child
	});

	it("setFor does not expose system metadata fields (filePath, moduleID, etc.)", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.metadata.setFor("math", "category", "arithmetic");

		const meta = api.slothlet.metadata.getFor("math");
		expect(meta.filePath).toBeUndefined();
		expect(meta.moduleID).toBeUndefined();
		expect(meta.apiPath).toBeUndefined();
		expect(meta.taggedAt).toBeUndefined();
	});

	// ── setGlobal + getFor ───────────────────────────────────────────────────────

	it("setGlobal (string-key form) is visible via getFor on any path", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.metadata.setGlobal("env", "browser-test");

		const mathMeta = api.slothlet.metadata.getFor("math");
		expect(mathMeta.env).toBe("browser-test");

		const authMeta = api.slothlet.metadata.getFor("auth");
		expect(authMeta.env).toBe("browser-test");
	});

	it("setGlobal (object form) is visible via getFor on any path", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.metadata.setGlobal({ build: "ci", region: "us" });

		const meta = api.slothlet.metadata.getFor("math.add");
		expect(meta.build).toBe("ci");
		expect(meta.region).toBe("us");
	});

	it("setFor key overrides setGlobal key at the same name", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.metadata.setGlobal("version", "global-1");
		api.slothlet.metadata.setFor("math", "version", "path-2");

		const meta = api.slothlet.metadata.getFor("math");
		// path-level wins over global
		expect(meta.version).toBe("path-2");
	});

	it("setGlobal is live — an update is reflected immediately in getFor", async () => {
		api = await slothlet(browserCfg(config));

		api.slothlet.metadata.setGlobal("counter", 1);
		expect(api.slothlet.metadata.getFor("math").counter).toBe(1);

		api.slothlet.metadata.setGlobal("counter", 2);
		expect(api.slothlet.metadata.getFor("math").counter).toBe(2);
	});

	// ── caller() from inside a browser-mode leaf ────────────────────────────────

	it("caller() inside probe.caller() returns null (the test is not a slothlet caller)", async () => {
		// probe.caller() calls `self?.slothlet?.metadata?.caller()` from inside the leaf.
		// The test invokes api.probe.caller() directly from outside slothlet — there is no
		// tracked slothlet callerWrapper in the context store — so caller() returns null.
		// This verifies the wrapper-metadata-based caller resolution path in browser mode.
		api = await slothlet(browserCfg(config));

		const result = await api.probe.caller();
		expect(result).toBeNull();
	});

	// ── getForVersion: no versioned fixture in api_test_browser ─────────────────

	it("getForVersion returns {} for a non-versioned path (no versioned fixture in browser fixture)", async () => {
		// FINDING: api_test_browser has no versioned modules. getForVersion requires a
		// registered versionManager entry (api.slothlet.metadata.getForVersion(logicalPath, versionTag)).
		// When versionManager.list(logicalPath) returns falsy or has no matching versionTag,
		// the implementation returns {}. This tests the no-version/default path rather than
		// fabricating a passing test against a fixture that does not exist.
		api = await slothlet(browserCfg(config));

		const meta = api.slothlet.metadata.getForVersion("math", "v1");
		expect(meta).toBeDefined();
		expect(typeof meta).toBe("object");
		expect(meta).not.toBeNull();
		// Returns {} because "math" has no version registry entry
		expect(Object.keys(meta)).toHaveLength(0);
	});
});
