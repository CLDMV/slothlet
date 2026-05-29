/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-loader-default-resolver.test.vitest.mjs
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
 * @fileoverview Coverage for the `#loadModuleBrowser` default-resolver branches.
 *
 * @description
 * Loader's browser-mode default resolver builds an importable URL from `config.base`
 * by branching on whether base is (a) already a URL with a scheme vs a plain
 * filesystem path, and (b) whether that URL/path already ends with a slash. The
 * standard browser integration suite always passes a no-trailing-slash absolute
 * filesystem path, so several branches in `#loadModuleBrowser` (lines 605-619)
 * never fire. This file targets each variant explicitly:
 *
 *  - `base` is a file:// URL with trailing slash
 *  - `base` is a file:// URL WITHOUT trailing slash
 *  - `base` is an absolute filesystem path with trailing slash
 *
 * @module tests/vitests/suites/browser/browser-loader-default-resolver
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, getManifest } from "../../setup/vitest-helper.mjs";

const FIXTURE_DIR = TEST_DIRS.API_TEST_BROWSER;
let BROWSER_MANIFEST;

beforeAll(async () => {
	BROWSER_MANIFEST = await getManifest(FIXTURE_DIR);
});

describe("Browser loader > default resolver — URL base variants", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("accepts a file:// URL base that already ends with /", async () => {
		// Exercises lines 609-611: base has scheme, base.endsWith("/") is true →
		// use base as-is.
		api = await slothlet({
			base: `file://${FIXTURE_DIR}/`,
			manifest: BROWSER_MANIFEST,
			mode: "eager"
		});
		expect(api.math.add(2, 3)).toBe(5);
	});

	it("accepts a file:// URL base WITHOUT trailing slash and appends one", async () => {
		// Exercises lines 609-612: base has scheme, base.endsWith("/") is false →
		// append "/" so new URL() resolves directory-style.
		api = await slothlet({
			base: `file://${FIXTURE_DIR}`,
			manifest: BROWSER_MANIFEST,
			mode: "eager"
		});
		expect(api.math.add(2, 3)).toBe(5);
	});

	it("accepts a filesystem base that already ends with /", async () => {
		// Exercises line 613: no scheme → file:// + base. The base.startsWith("/")
		// arm is the TRUE branch; the existing tests cover this via FIXTURE_DIR
		// without a trailing slash, this one adds the WITH-trailing-slash variant.
		api = await slothlet({
			base: `${FIXTURE_DIR}/`,
			manifest: BROWSER_MANIFEST,
			mode: "eager"
		});
		expect(api.math.add(2, 3)).toBe(5);
	});

	it("still works when config.dir is provided instead of config.base (back-compat)", async () => {
		// Exercises line 605 arm 1: config?.base ?? config?.dir → uses dir fallback.
		// `dir:` is deprecated but still accepted; this covers the fallback chain.
		api = await slothlet({
			dir: FIXTURE_DIR,
			manifest: BROWSER_MANIFEST,
			mode: "eager",
			silent: true
		});
		expect(api.math.add(2, 3)).toBe(5);
	});
});
