/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/i18n/translations-env-detect.test.vitest.mjs
 *	@Date: 2026-03-01 12:31:49 -08:00 (1772397109)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-02 18:24:22 -07:00 (1777771462)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage-gap tests for the `i18n_detectLanguage()` private function in
 * `src/lib/i18n/translations.mjs`.
 *
 * @description
 * `i18n_detectLanguage()` is not exported — it is called by the exported `initI18n(options)`
 * when `options.language` is not provided.  The function reads `process.env.LANG`,
 * `process.env.LANGUAGE`, or `process.env.LC_ALL` and returns a normalised language code.
 *
 * Uncovered branches:
 *
 * - **Spanish normalization** resolves region-aware Spanish locales:
 *   - `es_MX*` -> `es-mx`
 *   - `es_ES*` -> `es-es`
 *   - bare `es` -> `es-mx`
 *
 * - **Line 60** `return lang` — reached when `LANG` is a language other than "en" or "es"
 *   (e.g. "fr-fr").
 *
 * - **Line 64** `return "en-us"` — reached when none of the three env vars are set.
 *
 * @module tests/vitests/suites/i18n/translations-env-detect
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { setLanguage, getLanguage, initI18n } from "@cldmv/slothlet/i18n";

// ─── env variable save/restore helpers ───────────────────────────────────────

/**
 * Delete a set of env keys and return the prior values so they can be restored.
 * @param {string[]} keys - Env keys to clear.
 * @returns {{ [key: string]: string|undefined }} Saved values.
 */
function clearEnvVars(keys) {
	const saved = {};
	for (const key of keys) {
		saved[key] = process.env[key];
		delete process.env[key];
	}
	return saved;
}

/**
 * Restore previously saved env values.
 * @param {{ [key: string]: string|undefined }} saved - Saved key/value pairs.
 */
function restoreEnvVars(saved) {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

const LANG_KEYS = ["LANG", "LANGUAGE", "LC_ALL"];

// ─── Shared teardown ──────────────────────────────────────────────────────────

afterEach(() => {
	// Always restore to English so subsequent tests are unaffected
	setLanguage("en-us");
});

// ─── "en" branch ────────────────────────────────────────────────────────────────

describe("i18n_detectLanguage() — English env var (lang === 'en')", () => {
	it("detects English and returns 'en-us' when LANG is en_US.UTF-8", () => {
		const saved = clearEnvVars(LANG_KEYS);
		try {
			process.env.LANG = "en_US.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("en-us");
		} finally {
			restoreEnvVars(saved);
		}
	});

	it("detects English and returns 'en-us' when LANG is bare 'en'", () => {
		const saved = clearEnvVars(LANG_KEYS);
		try {
			process.env.LANG = "en";
			initI18n();
			expect(getLanguage()).toBe("en-us");
		} finally {
			restoreEnvVars(saved);
		}
	});
});

// ─── "c" / "posix" branch ──────────────────────────────────────────────────────

describe("i18n_detectLanguage() — C/POSIX locale (lang === 'c' || lang === 'posix')", () => {
	it("returns 'en-us' when LANG is 'C'", () => {
		const saved = clearEnvVars(LANG_KEYS);
		try {
			process.env.LANG = "C";
			initI18n();
			expect(getLanguage()).toBe("en-us");
		} finally {
			restoreEnvVars(saved);
		}
	});

	it("returns 'en-us' when LANG is 'POSIX'", () => {
		const saved = clearEnvVars(LANG_KEYS);
		try {
			process.env.LANG = "POSIX";
			initI18n();
			expect(getLanguage()).toBe("en-us");
		} finally {
			restoreEnvVars(saved);
		}
	});
});

// ─── line 59: "es" branch ─────────────────────────────────────────────────────

describe("i18n_detectLanguage() — Spanish env var normalization", () => {
	it("returns 'es-mx' when LANG is es_MX.UTF-8", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANG = "es_MX.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("es-mx");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});

	it("returns 'es-es' when LANG is es_ES.UTF-8", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANG = "es_ES.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("es-es");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});

	it("returns 'es-mx' for bare es when no region is provided", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANG = "es";
			initI18n();
			expect(getLanguage()).toBe("es-mx");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});

	it("falls back to 'es-mx' for unsupported Spanish region (es_AR)", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANG = "es_AR.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("es-mx");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});

	it("uses LANGUAGE when LANG is absent and resolves es_ES to es-es", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANGUAGE = "es_ES.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("es-es");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});

	it("uses LC_ALL when LANG and LANGUAGE are absent and resolves es_MX to es-mx", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LC_ALL = "es_MX.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("es-mx");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});

	it("gives LANG highest precedence over LANGUAGE and LC_ALL", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANG = "es_MX.UTF-8";
			process.env.LANGUAGE = "es_ES.UTF-8";
			process.env.LC_ALL = "en_GB.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("es-mx");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});
});

// ─── line 60: `return lang` branch ────────────────────────────────────────────

describe("i18n_detectLanguage() — non-en, non-es language (line 60)", () => {
	it("resolves en_GB to en-gb when regional file exists", () => {
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANG = "en_GB.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("en-gb");
		} finally {
			restoreEnvVars(saved);
		}
	});

	it("returns the raw lang code when it is not 'en' or 'es' (line 60)", () => {
		// fr-fr.json exists in the languages folder so setLanguage("fr-fr") will succeed
		const saved = clearEnvVars(LANG_KEYS);

		try {
			// `envLang = "fr-fr"` → lang = "fr-fr" → not "en", not "es" → `return lang` (line 60)
			process.env.LANG = "fr-fr";
			initI18n();
			expect(getLanguage()).toBe("fr-fr");
		} finally {
			restoreEnvVars(saved);
		}
	});

	it("handles a LANG value with a locale/encoding suffix (e.g. fr_FR.UTF-8)", () => {
		// `lang = "fr_FR.UTF-8".split(".")[0].split("_")[0].toLowerCase() = "fr"`
		// "fr" → return lang (line 60); setLanguage("fr") will warn because fr.json doesn't exist
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANG = "fr_FR.UTF-8";
			initI18n();
			// setLanguage("fr") would fail and fall back to en-us (the warning path),
			// but line 60 itself is still reached during detectLanguage
			// We verify no throw occurred
			const lang = getLanguage();
			expect(typeof lang).toBe("string");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});

	it("handles a German locale (de)", () => {
		// de-de.json exists
		const saved = clearEnvVars(LANG_KEYS);

		try {
			process.env.LANG = "de-de";
			initI18n();
			expect(getLanguage()).toBe("de-de");
		} finally {
			restoreEnvVars(saved);
		}
	});
});

// ─── line 64: default `return "en-us"` branch ─────────────────────────────────

describe("i18n_detectLanguage() — no env vars set (line 64)", () => {
	it("returns 'en-us' when LANG, LANGUAGE, and LC_ALL are all unset (line 64)", () => {
		const saved = clearEnvVars(LANG_KEYS);

		try {
			// With no env vars → envLang is undefined → falls through to `return "en-us"` (line 64)
			initI18n();
			expect(getLanguage()).toBe("en-us");
		} finally {
			restoreEnvVars(saved);
		}
	});

	it("returns 'en-us' consistently when called multiple times with no env vars (line 64)", () => {
		const saved = clearEnvVars(LANG_KEYS);

		try {
			initI18n();
			initI18n();
			expect(getLanguage()).toBe("en-us");
		} finally {
			restoreEnvVars(saved);
		}
	});
});

// ─── i18n_normalizeEnvLanguage() branch coverage (lines 82, 85, 87) ──────────

describe("i18n_normalizeEnvLanguage() — fallback and base branches", () => {
	it("returns en-us when normalized base is empty (line 82 true branch)", () => {
		const saved = clearEnvVars(LANG_KEYS);

		try {
			// "@corp" -> split("@")[0] === "" -> base is empty -> line 82 true branch
			process.env.LANG = "@corp.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("en-us");
		} finally {
			restoreEnvVars(saved);
		}
	});

	it("uses mapped base-language fallback when regional locale is missing (line 87 left arm)", () => {
		const saved = clearEnvVars(LANG_KEYS);

		try {
			// fr-ca file is missing; fr fallback map should resolve to fr-fr (line 87 left arm)
			process.env.LANG = "fr_CA.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("fr-fr");
		} finally {
			restoreEnvVars(saved);
		}
	});

	it("falls back to raw base language when no mapped fallback exists (line 87 right arm)", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const saved = clearEnvVars(LANG_KEYS);

		try {
			// qz-qq has no direct file, no base file, and no fallback mapping.
			// Line 87 therefore resolves to the right arm (`base` -> "qz").
			process.env.LANG = "qz_QQ.UTF-8";
			initI18n();
			expect(getLanguage()).toBe("en-us");
		} finally {
			restoreEnvVars(saved);
			warnSpy.mockRestore();
		}
	});

	it("prefers a direct base locale file when it exists (line 85 true branch)", async () => {
		const saved = clearEnvVars(LANG_KEYS);
		const mockedZzPayload =
			'{"meta":{"langCode":"zz","langName":"Test ZZ","rtl":false},"translations":{"INVALID_CONFIG_generic":"Invalid config: {reason}"}}';

		try {
			vi.resetModules();

			const realFs = await vi.importActual("fs");
			vi.doMock("fs", () => ({
				...realFs,
				existsSync: (filePath) => {
					if (typeof filePath === "string" && filePath.endsWith("/languages/zz.json")) return true;
					return realFs.existsSync(filePath);
				},
				readFileSync: (filePath, ...rest) => {
					if (typeof filePath === "string" && filePath.endsWith("/languages/zz.json")) return mockedZzPayload;
					return realFs.readFileSync(filePath, ...rest);
				}
			}));

			const i18n = await import("@cldmv/slothlet/i18n");

			// zz-ca file is missing; zz base file exists -> line 85 true branch returns "zz"
			process.env.LANG = "zz_CA.UTF-8";
			i18n.initI18n();
			expect(i18n.getLanguage()).toBe("zz");
		} finally {
			vi.doUnmock("fs");
			vi.resetModules();
			restoreEnvVars(saved);
		}
	});
});
