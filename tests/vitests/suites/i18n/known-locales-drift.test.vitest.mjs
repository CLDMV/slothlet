/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/i18n/known-locales-drift.test.vitest.mjs
 *	@Date: 2026-05-30 00:06:52 -07:00 (1780124812)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:18:07 -07:00 (1780546687)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Drift guard for the browser-side i18n `KNOWN_LOCALES` list.
 *
 * @description
 * In Node, locale availability is probed against the filesystem. In a browser there is no
 * filesystem, so `translations.mjs` keeps a static `KNOWN_LOCALES` set used by
 * `i18n_languageFileExists`. This test fails if that static list drifts from the actually
 * shipped `languages/*.json` files (e.g. a locale was added/removed but the list wasn't
 * updated), which would silently break browser locale detection for the affected locale.
 *
 * @module tests/vitests/suites/i18n/known-locales-drift
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("i18n — KNOWN_LOCALES drift guard", () => {
	it("the static browser KNOWN_LOCALES list matches the shipped languages/*.json files", () => {
		const root = process.cwd();

		// The locales actually shipped on disk.
		const shipped = readdirSync(join(root, "src/lib/i18n/languages"))
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.slice(0, -5))
			.sort();

		// The static list hard-coded in translations.mjs (the browser-only fallback).
		const src = readFileSync(join(root, "src/lib/i18n/translations.mjs"), "utf8");
		const match = src.match(/const KNOWN_LOCALES = new Set\(\[([\s\S]*?)\]\)/);
		expect(match, "KNOWN_LOCALES = new Set([...]) literal not found in translations.mjs").toBeTruthy();
		const known = [...match[1].matchAll(/["']([a-z]{2}-[a-z]{2})["']/g)].map((m) => m[1]).sort();

		expect(known, "browser KNOWN_LOCALES is out of sync with shipped languages/*.json — update the static list in src/lib/i18n/translations.mjs").toEqual(shipped);
	});
});
