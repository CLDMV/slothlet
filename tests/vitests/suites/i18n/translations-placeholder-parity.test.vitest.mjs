/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/i18n/translations-placeholder-parity.test.vitest.mjs
 *	@Date: 2026-11-22T18:00:00-08:00 (1795399200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:57-08:00 (1795869117)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every locale's message carries the same `{placeholder}` names as the en-us message, and
 * `npm run i18n:check` reports a locale that does not.
 *
 * @description
 * A message is formatted by replacing `{name}` with the value of that name. A translation that drops a placeholder
 * hides the value (the folder, the error, the limit) from everyone reading that locale; one that adds an unknown name
 * prints it literally.
 */

import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../../../..");
const LANGUAGES = join(ROOT, "src/lib/i18n/languages");
const CHECK = join(ROOT, "tools/ci/check-i18n-languages.mjs");

/**
 * The placeholder names in a message, sorted.
 * @param {string} message - The message.
 * @returns {string[]} The names.
 */
const placeholders = (message) => [...new Set([...String(message).matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]))].sort();

const read = (file) => JSON.parse(readFileSync(join(LANGUAGES, file), "utf8")).translations;

describe("i18n placeholder parity", () => {
	const base = read("en-us.json");
	const locales = readdirSync(LANGUAGES).filter((file) => file.endsWith(".json") && file !== "en-us.json");

	it.each(locales)("%s uses the en-us placeholders in every message", (file) => {
		const translations = read(file);
		const drift = [];
		for (const [key, message] of Object.entries(base)) {
			if (!(key in translations)) continue;
			const want = placeholders(message).join(",");
			const got = placeholders(translations[key]).join(",");
			if (want !== got) drift.push(`${key}: en-us {${want}} vs {${got}}`);
		}
		expect(drift).toEqual([]);
	});

	it("i18n:check fails on a locale that drops a placeholder", () => {
		mkdirSync(join(ROOT, "tmp"), { recursive: true });
		const dir = mkdtempSync(join(ROOT, "tmp", "i18n-placeholder-"));
		try {
			writeFileSync(join(dir, "en-us.json"), JSON.stringify({ translations: { GREETING: "Hello {name}, you have {count} items" } }));
			writeFileSync(join(dir, "de-de.json"), JSON.stringify({ translations: { GREETING: "Hallo {name}" } }));
			const res = spawnSync(process.execPath, [CHECK, "--dir", dir], { cwd: ROOT, encoding: "utf8" });
			expect(res.status).toBe(1);
			expect(res.stdout).toContain("PLACEHOLDERS");
			expect(res.stdout).toContain("GREETING");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
