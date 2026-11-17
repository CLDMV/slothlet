/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/i18n/language-load-warning.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:01-08:00 (1794882601)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #820 — a locale that fails to load raises a coded, translated `WARNING_LANGUAGE_LOAD_FAILED`
 * SlothletWarning instead of a bare console.warn. It honours `silent`, and an instance captures its own
 * (the per-instance capture of #819). Outside any instance it lands on the process-level class.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { language } from "@cldmv/slothlet/i18n";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";
import { captureWarnings } from "../../setup/warning-capture.mjs";

const CODE = "WARNING_LANGUAGE_LOAD_FAILED";

/**
 * Warnings with the load-failed code on an instance.
 * @param {object} api - Bound api.
 * @returns {object[]} Warnings.
 */
const failed = (api) => api.slothlet.warnings.get().filter((w) => w.code === CODE);

describe("a failed locale load is a coded SlothletWarning (#820)", () => {
	let api;
	let other;

	afterEach(async () => {
		vi.restoreAllMocks();
		if (api) await api.shutdown();
		if (other) await other.shutdown();
		api = other = null;
		language.set("en-us");
	});

	it("init with an unknown i18n.language warns on that instance, translated, and falls back to English", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, diagnostics: true, i18n: { language: "zz-zz" } });
		const [warning] = failed(api);
		expect(warning).toBeInstanceOf(SlothletWarning);
		expect(warning.details).toEqual({ lang: "zz-zz" });
		expect(warning.message).toBe("Failed to load language 'zz-zz', falling back to English.");
		expect(language.get()).toBe("en-us");
	});

	it("silent still records it, unprinted (#838)", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, diagnostics: true, silent: true, i18n: { language: "zz-zz" } });
		expect(failed(api)).toHaveLength(1);
	});

	it("is captured on the instance that asked, not another", async () => {
		other = await slothlet({ base: TEST_DIRS.API_TEST, diagnostics: true });
		api = await slothlet({ base: TEST_DIRS.API_TEST, diagnostics: true, i18n: { language: "zz-zz" } });
		expect(failed(api)).toHaveLength(1);
		expect(failed(other)).toEqual([]);
	});

	it("api.slothlet.i18n.language.set warns on the instance", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, diagnostics: true });
		api.slothlet.i18n.language.set("zz-zz");
		await api.slothlet.i18n.language.set("yy-yy");
		expect(failed(api).map((w) => w.details.lang)).toEqual(["zz-zz", "yy-yy"]);
	});

	it("api.slothlet.i18n.language.set records on a silent instance too (#838)", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, diagnostics: true, silent: true });
		api.slothlet.i18n.language.set("zz-zz");
		await api.slothlet.i18n.language.set("yy-yy");
		expect(failed(api).map((w) => w.details.lang)).toEqual(["zz-zz", "yy-yy"]);
	});

	it("outside any instance the warning is printed, not kept by an instance", async () => {
		const printed = await captureWarnings(async () => {
			language.set("zz-zz");
			await language.set("yy-yy");
		});
		expect(printed.filter((w) => w.code === CODE).map((w) => w.details.lang)).toEqual(["zz-zz", "yy-yy"]);
	});

	it("prints no bare console.warn line of its own", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		language.set("zz-zz");
		// The process-level class prints every warning (#838); each line printed belongs to the warning itself.
		const own = warn.mock.calls.filter(([first]) => !(typeof first === "string" && first.startsWith("\n⚠️  [")) && first !== "Context:");
		expect(own).toEqual([]);
		warn.mockRestore();
	});
});
