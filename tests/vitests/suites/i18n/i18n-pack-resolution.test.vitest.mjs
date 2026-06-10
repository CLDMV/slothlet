/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/i18n/i18n-pack-resolution.test.vitest.mjs
 *	@Date: 2026-06-09 22:15:50 -07:00 (1781068550)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-09 22:16:40 -07:00 (1781068600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tier-1 i18n resolution: when the optional @cldmv/slothlet-i18n pack is installed,
 * slothlet loads non-base locales from it and the browser importmap enumerates it. A throwaway pack
 * is fixtured into node_modules (so `import.meta.resolve` finds it) and removed afterward.
 * @module tests/vitests/suites/i18n/i18n-pack-resolution
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const PACK_DIR = join(process.cwd(), "node_modules", "@cldmv", "slothlet-i18n");
const PACK_LOCALE = "qa-pack"; // deliberately not a real/known locale
const PACK_MESSAGE = "Loaded from the @cldmv/slothlet-i18n pack";

describe("i18n — @cldmv/slothlet-i18n pack resolution (tier 1)", () => {
	beforeAll(() => {
		rmSync(PACK_DIR, { recursive: true, force: true }); // idempotent against a leftover fixture
		mkdirSync(join(PACK_DIR, "languages"), { recursive: true });
		writeFileSync(
			join(PACK_DIR, "package.json"),
			JSON.stringify({
				name: "@cldmv/slothlet-i18n",
				version: "0.0.0-fixture",
				type: "module",
				exports: { "./package.json": "./package.json", "./language/*": "./languages/*" }
			})
		);
		writeFileSync(join(PACK_DIR, "languages", `${PACK_LOCALE}.json`), JSON.stringify({ translations: { TEST_PACK_KEY: PACK_MESSAGE } }));
	});

	afterAll(() => {
		rmSync(PACK_DIR, { recursive: true, force: true });
	});

	it("setLanguage loads a non-base locale from the installed pack", async () => {
		const i18n = await import("@cldmv/slothlet/i18n");
		i18n.setLanguage(PACK_LOCALE);
		expect(i18n.getLanguage()).toBe(PACK_LOCALE);
		expect(i18n.translate("TEST_PACK_KEY")).toBe(PACK_MESSAGE);
		i18n.setLanguage("en-us"); // reset shared module state
	});

	it("generateImportMap enumerates the pack's locales when it's installed", async () => {
		const { generateImportMap } = await import("@cldmv/slothlet/helpers/generate-manifest");
		const { imports } = await generateImportMap("/node_modules/@cldmv/slothlet/");
		expect(imports).toHaveProperty(
			`@cldmv/slothlet-i18n/language/${PACK_LOCALE}.json`,
			`/node_modules/@cldmv/slothlet-i18n/languages/${PACK_LOCALE}.json`
		);
	});
});
