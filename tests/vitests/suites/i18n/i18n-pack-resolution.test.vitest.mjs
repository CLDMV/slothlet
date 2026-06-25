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
 * slothlet loads non-base locales from it and the browser importmap enumerates it. The pack is staged
 * ONCE by the runner (tests/vitests/setup/i18n-pack-fixture.mjs) before any worker; this suite asserts
 * the staged signal and consumes the pack, so it must run through the runner — a bare `npx vitest` run
 * (where the pack was never staged) fails loudly instead of silently resolving the internal copy.
 * @module tests/vitests/suites/i18n/i18n-pack-resolution
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PACK_LOCALE, PACK_MESSAGE, PACK_KEY, packDir, assertI18nPackStaged } from "../../setup/i18n-pack-fixture.mjs";

const PACK_DIR = packDir();

describe("i18n — @cldmv/slothlet-i18n pack resolution (tier 1)", () => {
	// The runner stages the pack before any worker spawns; a bare run (STAGED_ENV unset) fails here.
	beforeAll(() => {
		assertI18nPackStaged();
	});

	it("setLanguage loads a non-base locale from the installed pack", async () => {
		const i18n = await import("@cldmv/slothlet/i18n");
		i18n.setLanguage(PACK_LOCALE);
		expect(i18n.getLanguage()).toBe(PACK_LOCALE);
		expect(i18n.translate(PACK_KEY)).toBe(PACK_MESSAGE);
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

	it("generateImportMap derives the pack base from a versioned CDN base (preserves @version)", async () => {
		const { generateImportMap } = await import("@cldmv/slothlet/helpers/generate-manifest");
		const { imports } = await generateImportMap("https://cdn.example.com/@cldmv/slothlet@3/");
		// The pack base must swap the final `@cldmv/slothlet` segment while keeping the `@3` version —
		// not leave pack locales pointing into the (versioned) slothlet base.
		expect(imports).toHaveProperty(
			`@cldmv/slothlet-i18n/language/${PACK_LOCALE}.json`,
			`https://cdn.example.com/@cldmv/slothlet-i18n@3/languages/${PACK_LOCALE}.json`
		);
	});

	it("omits pack locale entries when the base has no @cldmv/slothlet segment to swap", async () => {
		const { generateImportMap } = await import("@cldmv/slothlet/helpers/generate-manifest");
		// A custom base served at the site root has no `@cldmv/slothlet` segment, so the pack-base swap is
		// a no-op; emitting `${base}languages/*` would point into the slothlet base, not the pack. Expect
		// no pack entries rather than wrong ones.
		const { imports } = await generateImportMap("/");
		expect(imports).not.toHaveProperty(`@cldmv/slothlet-i18n/language/${PACK_LOCALE}.json`);
	});

	it("setLanguage warns and keeps en-us when the pack locale file is corrupt", async () => {
		writeFileSync(join(PACK_DIR, "languages", "qa-corrupt.json"), "{ not valid json !");
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const i18n = await import("@cldmv/slothlet/i18n");
			i18n.setLanguage("qa-corrupt");
			expect(i18n.getLanguage()).toBe("en-us");
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("qa-corrupt"));
		} finally {
			warnSpy.mockRestore();
			rmSync(join(PACK_DIR, "languages", "qa-corrupt.json"), { force: true });
		}
	});

	it("setLanguageAsync warns and keeps en-us when the pack locale file is corrupt", async () => {
		writeFileSync(join(PACK_DIR, "languages", "qa-corrupt-async.json"), "{ not valid json !");
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const i18n = await import("@cldmv/slothlet/i18n");
			await i18n.setLanguageAsync("qa-corrupt-async");
			expect(i18n.getLanguage()).toBe("en-us");
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("qa-corrupt-async"));
		} finally {
			warnSpy.mockRestore();
			rmSync(join(PACK_DIR, "languages", "qa-corrupt-async.json"), { force: true });
		}
	});

	it("falls through to the internal locale when the pack copy is corrupt", async () => {
		// Shadow a REAL internal locale with a corrupt pack copy: the pack ref fails to parse, the
		// loader continues to the next candidate (the in-repo file) and the switch still succeeds.
		// es-mx ships in the staged pack, so save its real content and restore it afterward.
		const esMx = join(PACK_DIR, "languages", "es-mx.json");
		const original = readFileSync(esMx, "utf8");
		writeFileSync(esMx, "{ not valid json !");
		try {
			const i18n = await import("@cldmv/slothlet/i18n");
			i18n.setLanguage("es-mx");
			expect(i18n.getLanguage()).toBe("es-mx");
			i18n.setLanguage("en-us"); // reset shared module state
		} finally {
			writeFileSync(esMx, original);
		}
	});

	it("returns null and uses the internal copy when pack-path resolution throws (catch arm)", async () => {
		// The catch arm of i18n_resolvePackPath is the production path for users WITHOUT the optional pack
		// (import.meta.resolve throws). The runner stages the pack for the whole run, and removing it from
		// disk poisons vitest's per-worker resolution cache — so instead make the platform helper's
		// url.fileURLToPath throw for the pack URL only. The module's own dirname resolution (a non-pack
		// URL) still works, so the module loads; only the pack-path resolution lands in the catch and the
		// loader falls through to the internal copy.
		vi.resetModules();
		const platform = await vi.importActual("@cldmv/slothlet/helpers/platform");
		vi.doMock("@cldmv/slothlet/helpers/platform", () => ({
			...platform,
			url: {
				...platform.url,
				fileURLToPath: (u) => {
					if (String(u).includes("slothlet-i18n")) throw new Error("pack path unresolved");
					return platform.url.fileURLToPath(u);
				}
			}
		}));
		try {
			const i18n = await import("@cldmv/slothlet/i18n");
			i18n.setLanguage("es-mx");
			expect(i18n.getLanguage()).toBe("es-mx"); // pack path threw → catch → internal copy
			i18n.setLanguage("en-us");
		} finally {
			vi.doUnmock("@cldmv/slothlet/helpers/platform");
			vi.resetModules();
		}
	});
});
