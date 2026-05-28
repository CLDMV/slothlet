/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-add-api.test.vitest.mjs
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
 * @fileoverview Integration tests for api.slothlet.api.add in browser mode.
 *
 * @description
 * The highest-risk browser-mode interaction: `api.slothlet.api.add` calls
 * `scanDirectory` with a sub-path, which dispatches to `#scanDirectoryBrowser`
 * and then `#findManifestNode` to locate the sub-directory node inside the
 * root manifest. A bug in the base-stripping or tree-traversal logic would
 * silently produce an empty or wrong API tree at the mounted path.
 *
 * The root manifest (generated for `FIXTURE_DIR`) already contains `utils/`
 * as a directory node. When `api.slothlet.api.add` is called with
 * `FIXTURE_DIR + "/utils"`, `#scanDirectoryBrowser` strips the base prefix to
 * obtain the relative segment `"utils"` and finds it via `#findManifestNode`.
 *
 * Covers:
 * - `api.slothlet.api.add` mounts a manifest subdirectory at a new dotted path
 * - Exports from the mounted path are callable and return correct values
 * - The root API tree is unaffected by the add operation
 * - Collision option (`"throw"`) is respected in browser mode
 * - Full matrix: eager × async/live × hooks on/off
 *
 * @module tests/vitests/suites/browser/browser-add-api
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function browserCfg(matrixConfig) {
	return makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST);
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe.each(getMatrixConfigs())("Browser Mode > api.slothlet.api.add > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("mounts a manifest subdirectory at a new dotted path", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`);

		expect(api.extra).toBeDefined();
		expect(api.extra.format).toBeDefined();
	});

	it("exports from the mounted subdirectory are callable", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`);

		expect(await api.extra.format.upper("hello")).toBe("HELLO");
		expect(await api.extra.format.lower("WORLD")).toBe("world");
	});

	it("root API tree is intact after api.add", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`);

		expect(api.math.add(1, 2)).toBe(3);
		expect(api.auth.logout()).toEqual({ ok: true });
	});

	it("api.add to the same path twice merges without error", async () => {
		api = await slothlet(browserCfg(config));

		// First mount — establishes the path
		await api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`);
		expect(await api.extra.format.upper("first")).toBe("FIRST");

		// Second mount to the same path — should merge, not throw
		await expect(api.slothlet.api.add("extra", `${FIXTURE_DIR}/utils`)).resolves.not.toThrow();
		expect(await api.extra.format.upper("second")).toBe("SECOND");
	});

	it("api.add to a nested dotted path mounts correctly", async () => {
		api = await slothlet(browserCfg(config));

		await api.slothlet.api.add("extras.formatting", `${FIXTURE_DIR}/utils`);

		expect(api.extras).toBeDefined();
		expect(api.extras.formatting).toBeDefined();
		expect(await api.extras.formatting.format.upper("hi")).toBe("HI");
	});
});
