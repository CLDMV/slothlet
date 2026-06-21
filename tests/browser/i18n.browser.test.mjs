/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/i18n.browser.test.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Drives the browser-only arms of the i18n module (src/lib/i18n/translations.mjs) in a
 * real headless Chromium. In a browser `isNode` is false, so locale detection comes from
 * navigator.languages and locale files load asynchronously via dynamic JSON import (importmap) rather
 * than the filesystem. These are the paths the node suite can only v8-ignore.
 */

import { describe, it, expect } from "vitest";

describe("i18n browser-only paths", () => {
	it("module import + detect + sync/async locale switch exercise the browser arms", async () => {
		const i18n = await import("@cldmv/slothlet/i18n");

		// Importing the module already ran the init arm: translations_dirname = isNode ? … : null.
		// initI18n() runs i18n_detectLanguage() → navigator.languages browser arm.
		i18n.initI18n();
		expect(typeof i18n.getLanguage()).toBe("string");

		// setLanguage() in a browser hits the fire-and-forget async arm (can't read locale sync).
		i18n.setLanguage("es-mx");
		// en-us short-circuits before the browser arm — exercise that path too.
		i18n.setLanguage("en-us");
		expect(i18n.getLanguage()).toBe("en-us");
		// A falsy lang reaches the browser arm but skips the async load (the `if (lang && …)` false arm).
		i18n.setLanguage("");
		expect(i18n.getLanguage()).toBe("en-us");

		// setLanguageAsync() is the browser-capable path: dynamic import of the locale JSON
		// (i18n_localeRef returns a package specifier, resolved via the importmap).
		await i18n.setLanguageAsync("es-mx");
		expect(["es-mx", "en-us"]).toContain(i18n.getLanguage());

		// A bad locale warns + keeps en-us (the failed-load branch).
		await i18n.setLanguageAsync("zz-zz");
		expect(typeof i18n.getLanguage()).toBe("string");

		// translate() reads the current table; a param with an undefined value hits the
		// `value !== undefined ? … : ""` fallback arm.
		expect(typeof i18n.translate("INTERNAL_ERROR", { missing: undefined })).toBe("string");
	});

	it("language detection falls back through navigator.language → en-us", async () => {
		const i18n = await import("@cldmv/slothlet/i18n");
		// Capture the ORIGINAL own-property state. navigator.language(s) normally live on
		// Navigator.prototype (no own property on the instance), so a clean revert must DELETE the
		// stubbed own property — copying the prototype descriptor onto the instance would leave an own
		// property behind and leak state into later browser tests.
		const hadOwnLangs = Object.prototype.hasOwnProperty.call(navigator, "languages");
		const ownLangs = hadOwnLangs ? Object.getOwnPropertyDescriptor(navigator, "languages") : null;
		const hadOwnLang = Object.prototype.hasOwnProperty.call(navigator, "language");
		const ownLang = hadOwnLang ? Object.getOwnPropertyDescriptor(navigator, "language") : null;
		try {
			// languages[0] falsy → `|| navigator.language` fallback arm.
			Object.defineProperty(navigator, "languages", { get: () => [], configurable: true });
			Object.defineProperty(navigator, "language", { get: () => "fr-FR", configurable: true });
			i18n.initI18n();
			expect(typeof i18n.getLanguage()).toBe("string");

			// both empty → navLang falsy → the `: "en-us"` arm.
			Object.defineProperty(navigator, "language", { get: () => "", configurable: true });
			i18n.initI18n();
			expect(i18n.getLanguage()).toBe("en-us");
		} finally {
			if (hadOwnLangs) Object.defineProperty(navigator, "languages", ownLangs);
			else delete navigator.languages;
			if (hadOwnLang) Object.defineProperty(navigator, "language", ownLang);
			else delete navigator.language;
		}
	});
});
