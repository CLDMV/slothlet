/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-env-snapshot.test.vitest.mjs
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
 * @fileoverview Contract test for `api.slothlet.env` in browser mode.
 *
 * @description
 * In a real browser, `process` is undefined and reading `process.env` throws.
 * The current `_captureEnvSnapshot()` runs unconditionally and would crash.
 * The contract: when `envTarget === "browser"` (auto-detected via `manifest`
 * presence or set via `platform: "browser"`), `api.slothlet.env` must be an empty
 * frozen object — regardless of whether `process` is defined at runtime.
 *
 * This also prevents Node env from leaking into "browser-mode" instances
 * (which all the browser tests today run under, since vitest runs in Node).
 *
 * @module tests/vitests/suites/browser/browser-env-snapshot
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getBrowserMatrixConfigs, TEST_DIRS, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;

let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

function browserCfg(matrixConfig) {
	return makeBrowserConfig(matrixConfig, FIXTURE_DIR, BROWSER_MANIFEST);
}

describe.each(getBrowserMatrixConfigs())("Browser Mode > env snapshot > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("api.slothlet.env is defined and frozen", async () => {
		api = await slothlet(browserCfg(config));
		expect(api.slothlet.env).toBeDefined();
		expect(Object.isFrozen(api.slothlet.env)).toBe(true);
	});

	it("api.slothlet.env is empty in browser mode (no Node env leakage)", async () => {
		// Set an env var that would obviously leak if browser mode captured it
		process.env.__SLOTHLET_BROWSER_LEAK_TEST__ = "should-not-leak";
		try {
			api = await slothlet(browserCfg(config));
			expect(Object.keys(api.slothlet.env)).toHaveLength(0);
			expect(api.slothlet.env.__SLOTHLET_BROWSER_LEAK_TEST__).toBeUndefined();
			expect(api.slothlet.env.NODE_ENV).toBeUndefined();
		} finally {
			delete process.env.__SLOTHLET_BROWSER_LEAK_TEST__;
		}
	});

	it("env.include allowlist is ignored in browser mode (no Node env source)", async () => {
		process.env.__SLOTHLET_INCLUDE_LEAK__ = "should-not-leak";
		try {
			api = await slothlet({
				...browserCfg(config),
				env: { include: ["__SLOTHLET_INCLUDE_LEAK__", "NODE_ENV"] }
			});
			// Even with an explicit allowlist, browser mode must not read process.env
			expect(api.slothlet.env.__SLOTHLET_INCLUDE_LEAK__).toBeUndefined();
			expect(api.slothlet.env.NODE_ENV).toBeUndefined();
		} finally {
			delete process.env.__SLOTHLET_INCLUDE_LEAK__;
		}
	});
});
