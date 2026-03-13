/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/i18n/public-i18n-api.test.vitest.mjs
 *	@Date: 2026-02-21T19:02:42-08:00 (1771729362)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:51 -08:00 (1772425311)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests that i18n is exposed publicly via api.slothlet.i18n and that
 * language changes affect translation output.
 * @module tests/vitests/suites/i18n/public-i18n-api
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Only LAZY configs (consistent with other public API surface tests)
const matrixConfigs = getMatrixConfigs({ mode: "lazy" });

/**
 * Creates an i18n test message for a key that is known to differ in es-mx.
 * @param {{ t: (code: string, params?: object) => string }} i18n - i18n API surface
 * @returns {{ message: string, expectedSpanishFragment: string }} Message and a spanish fragment to assert.
 */
function buildTranslationTestMessage(i18n) {
	return {
		message: i18n.t("NO_ACTIVE_CONTEXT_ASYNC"),
		expectedSpanishFragment: "Sin contexto activo"
	};
}

describe("Public I18N API (api.slothlet.i18n)", () => {
	describe.each(matrixConfigs)("Config: $name", ({ config }) => {
		let api;

		afterEach(async () => {
			try {
				if (api?.slothlet?.i18n?.setLanguage) {
					api.slothlet.i18n.setLanguage("en-us");
				}
			} finally {
				if (api && typeof api.shutdown === "function") {
					await api.shutdown();
				}
				api = null;
			}
		});

		it("should expose the i18n helpers on api.slothlet", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});

			expect(api.slothlet.i18n).toBeDefined();
			expect(typeof api.slothlet.i18n.setLanguage).toBe("function");
			expect(typeof api.slothlet.i18n.getLanguage).toBe("function");
			expect(typeof api.slothlet.i18n.translate).toBe("function");
			expect(typeof api.slothlet.i18n.t).toBe("function");
			expect(typeof api.slothlet.i18n.initI18n).toBe("function");
		});

		it("should change translation output when language changes", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});

			api.slothlet.i18n.setLanguage("en-us");
			const english = buildTranslationTestMessage(api.slothlet.i18n).message;
			expect(english).toContain("No active context");

			api.slothlet.i18n.setLanguage("es-mx");
			expect(api.slothlet.i18n.getLanguage()).toBe("es-mx");

			const spanish = buildTranslationTestMessage(api.slothlet.i18n).message;
			expect(spanish).toContain("Sin contexto activo");

			// Should not be identical if translations are actually switching
			expect(spanish).not.toBe(english);
		});

		it("should apply config.i18n.language at initialization", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				i18n: { language: "es-mx" }
			});

			expect(api.slothlet.i18n.getLanguage()).toBe("es-mx");

			const { message, expectedSpanishFragment } = buildTranslationTestMessage(api.slothlet.i18n);
			expect(message).toContain(expectedSpanishFragment);
		});
	});
});
