/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/ci/check-i18n-languages.mjs
 *	@Date: 2026-02-21T17:52:07-08:00 (1771725127)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-09 16:36:50 -07:00 (1773099410)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { readdirSync, readFileSync } from "fs";
import { dirname, extname, join, basename } from "path";
import { fileURLToPath } from "url";

/**
 * Safely parse a JSON file.
 * @param {string} filePath - Absolute path to the JSON file.
 * @returns {any} Parsed JSON.
 */
function parseJsonFile(filePath) {
	const raw = readFileSync(filePath, "utf-8");
	return JSON.parse(raw);
}

/**
 * Extract translation keys from a language JSON.
 * @param {any} langJson - Parsed language JSON.
 * @param {string} locale - Locale code for error messages.
 * @returns {Set<string>} Translation keys.
 */
function getTranslationKeys(langJson, locale) {
	if (!langJson || typeof langJson !== "object") {
		throw new Error(`[${locale}] Invalid JSON root (expected object).`);
	}
	if (!langJson.translations || typeof langJson.translations !== "object") {
		throw new Error(`[${locale}] Missing or invalid 'translations' object.`);
	}
	return new Set(Object.keys(langJson.translations));
}

/**
 * Compute the set difference A \ B.
 * @param {Set<string>} a - Left-hand set.
 * @param {Set<string>} b - Right-hand set.
 * @returns {string[]} Sorted array of items in A but not B.
 */
function difference(a, b) {
	const out = [];
	for (const item of a) {
		if (!b.has(item)) out.push(item);
	}
	return out.sort();
}

/**
 * Resolve the repo root from this tool file location.
 * @returns {string} Absolute path to the repo root.
 */
function resolveRepoRoot() {
	const toolDir = dirname(fileURLToPath(import.meta.url));
	return join(toolDir, "../..");
}

/**
 * Get the languages directory path.
 * @param {string} repoRoot - Absolute path to the repo root.
 * @returns {string} Absolute path to the languages directory.
 */
function resolveLanguagesDir(repoRoot) {
	return join(repoRoot, "src", "lib", "i18n", "languages");
}

/**
 * Parsed CLI arguments for check-i18n-languages.
 * @typedef {Object} ParsedI18nArgs
 * @property {string} [languagesDir] - Optional custom path to the languages directory (overrides default).
 */

/**
 * Parse CLI args.
 * @param {string[]} argv - Process argv.
 * @returns {ParsedI18nArgs} Parsed options.
 */
function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--dir" || arg === "-d") {
			out.languagesDir = argv[i + 1];
			i++;
		}
	}
	return out;
}

/**
 * Non-Latin-script locales the script-purity check applies to. Latin-script
 * locales (de-de, es-*, fr-fr, pt-br) can't be checked this way — every word
 * is Latin so the heuristic has no signal.
 */
const NON_LATIN_LOCALES = new Set(["hi-in", "ja-jp", "ko-kr", "ru-ru", "zh-cn"]);

/**
 * Minimum consecutive ASCII letters that count as an English leak. 2 is loose
 * by design — see `.github/instructions/rules/i18n-languages.instructions.md`.
 */
const SCRIPT_PURITY_MIN_RUN = 2;

/**
 * Bracket-wrapped uppercase tag pattern. Debug-trace messages prefix their
 * payload with tags like `[COLLISION-REPLACE]` or `[WAITING-APPLY-WALK]`;
 * wrapping makes them visually distinct from translated prose, and the audit
 * strips them before checking for Latin leakage. A bare (unwrapped) tag will
 * still be flagged so we know to wrap it.
 */
const BRACKETED_TAG = /\[[A-Z][A-Z0-9_:\-]*\]/g;

/**
 * Strip placeholder tokens and bracketed debug tags from a value before
 * running the Latin-run scan. Placeholders are templating (must be preserved
 * literally in every locale) and bracketed tags are API-trace markers, not
 * translatable content.
 * @param {string} value
 * @returns {string} Value with `{...}` runs and `[TAG]` runs removed.
 */
function stripNonContentTokens(value) {
	return value.replace(/\{[^}]+\}/g, "").replace(BRACKETED_TAG, "");
}

/**
 * Detect runs of ASCII Latin letters in a string after stripping
 * placeholders + bracketed tags, then filtering out tokens that appear in
 * the project-wide token allowlist.
 *
 * @param {string} value - Translation value.
 * @param {Set<string>} tokenAllowlist - Tokens accepted in any context
 *   (API surface names, config values, file extensions, etc.).
 * @returns {string[]} Distinct ASCII runs >= SCRIPT_PURITY_MIN_RUN letters
 *   that remain after stripping + token allowlist filtering.
 */
function findLatinRuns(value, tokenAllowlist) {
	const stripped = stripNonContentTokens(value);
	const matches = stripped.match(new RegExp(`[A-Za-z]{${SCRIPT_PURITY_MIN_RUN},}`, "g"));
	if (!matches) return [];
	// Distinct + allowlist filter, preserving order
	const seen = new Set();
	const out = [];
	for (const m of matches) {
		if (seen.has(m) || tokenAllowlist.has(m)) continue;
		seen.add(m);
		out.push(m);
	}
	return out;
}

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolveRepoRoot();
const languagesDir = args.languagesDir ? args.languagesDir : resolveLanguagesDir(repoRoot);

/**
 * Path to the script-purity full-value accepted sidecar. Each locale maps to
 * an array of full translation strings that have been manually verified as
 * containing legitimate Latin content not covered by the token allowlist.
 */
const acceptedPath = join(repoRoot, "tools", "ci", "i18n-script-purity-accepted.json");
let scriptPurityAccepted = {};
try {
	scriptPurityAccepted = parseJsonFile(acceptedPath);
} catch {
	// Missing or unparseable accepted file is fine — treat as empty allowlist.
	scriptPurityAccepted = {};
}

/**
 * Path to the project-wide Latin token allowlist. Tokens listed here are
 * accepted whenever they appear inside a non-Latin locale value — useful for
 * public API surface names, internal function names referenced in errors,
 * config option values, and file extensions.
 */
const tokensPath = join(repoRoot, "tools", "ci", "i18n-latin-tokens-accepted.json");
let latinTokenAllowlist = new Set();
try {
	const raw = parseJsonFile(tokensPath);
	const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.tokens) ? raw.tokens : [];
	latinTokenAllowlist = new Set(arr.filter((t) => typeof t === "string" && t.length > 0));
} catch {
	latinTokenAllowlist = new Set();
}

const baseLocale = "en-us";
const basePath = join(languagesDir, `${baseLocale}.json`);

let hasFailures = false;
const report = {
	base: baseLocale,
	totalKeys: 0,
	locales: {}
};

try {
	const baseJson = parseJsonFile(basePath);
	const baseKeys = getTranslationKeys(baseJson, baseLocale);
	report.totalKeys = baseKeys.size;

	const files = readdirSync(languagesDir)
		.filter((f) => extname(f) === ".json")
		.sort();

	const localeFiles = files.filter((f) => basename(f, ".json") !== baseLocale);

	if (files.length === 0) {
		console.error(`No .json files found in: ${languagesDir}`);
		process.exitCode = 2;
		process.exit();
	}

	console.log(`Base: ${baseLocale}.json (${baseKeys.size} keys)`);
	console.log(`Directory: ${languagesDir}`);
	console.log("-");

	for (const file of localeFiles) {
		const locale = basename(file, ".json");
		const filePath = join(languagesDir, file);

		let langJson;
		try {
			langJson = parseJsonFile(filePath);
		} catch (error) {
			hasFailures = true;
			console.log(`${locale}: FAIL (invalid JSON)`);
			console.log(String(error?.message || error));
			console.log("-");
			continue;
		}

		let langKeys;
		try {
			langKeys = getTranslationKeys(langJson, locale);
		} catch (error) {
			hasFailures = true;
			console.log(`${locale}: FAIL`);
			console.log(String(error?.message || error));
			console.log("-");
			continue;
		}

		const missing = difference(baseKeys, langKeys);
		const extra = difference(langKeys, baseKeys);

		// build per-locale report entry
		const localeReport = {
			missingCount: missing.length,
			missing: missing,
			extraCount: extra.length,
			extra: extra,
			duplicates: [],
			scriptPurityIssues: []
		};

		// Script-purity check: for non-Latin-script locales, flag values containing
		// runs of ASCII Latin letters that aren't pre-approved in the accepted file.
		if (NON_LATIN_LOCALES.has(locale)) {
			const accepted = new Set(Array.isArray(scriptPurityAccepted[locale]) ? scriptPurityAccepted[locale] : []);
			const translations = langJson.translations || {};
			for (const [key, value] of Object.entries(translations)) {
				const valueStr = String(value ?? "");
				if (accepted.has(valueStr)) continue;
				const runs = findLatinRuns(valueStr, latinTokenAllowlist);
				if (runs.length > 0) {
					localeReport.scriptPurityIssues.push({ key, value: valueStr, runs });
				}
			}
		}

		// Detect duplicate translation values within this locale
		try {
			const translations = langJson.translations || {};
			const valueMap = new Map();
			for (const [k, v] of Object.entries(translations)) {
				const keyVal = String(v ?? "");
				const arr = valueMap.get(keyVal) || [];
				arr.push(k);
				valueMap.set(keyVal, arr);
			}

			for (const [val, keys] of valueMap.entries()) {
				if (keys.length > 1) {
					// record duplicates (including empty strings)
					localeReport.duplicates.push({ value: val, keys });
				}
			}
		} catch {
			// non-fatal
		}

		report.locales[locale] = localeReport;

		if (
			missing.length === 0 &&
			extra.length === 0 &&
			localeReport.duplicates.length === 0 &&
			localeReport.scriptPurityIssues.length === 0
		) {
			console.log(`${locale}: OK`);
			console.log("-");
			continue;
		}

		if (missing.length > 0) {
			hasFailures = true;
			console.log(`${locale}: MISSING ${missing.length}`);
			for (const key of missing) console.log(`  - ${key}`);
		}

		if (extra.length > 0) {
			hasFailures = true;
			console.log(`${locale}: EXTRA ${extra.length}`);
			for (const key of extra) console.log(`  + ${key}`);
		}

		if (localeReport.duplicates.length > 0) {
			hasFailures = true;
			console.log(`${locale}: DUPLICATES ${localeReport.duplicates.length}`);
			for (const d of localeReport.duplicates) {
				console.log(`  * ${d.keys.length} keys duplicate value: "${d.value}"`);
				for (const k of d.keys) console.log(`    - ${k}`);
			}
		}

		if (localeReport.scriptPurityIssues.length > 0) {
			hasFailures = true;
			console.log(`${locale}: SCRIPT PURITY ${localeReport.scriptPurityIssues.length}`);
			for (const issue of localeReport.scriptPurityIssues) {
				console.log(`  ! ${issue.key}: latin runs [${issue.runs.join(", ")}]`);
				console.log(`    value: ${JSON.stringify(issue.value)}`);
			}
			console.log(
				`  → resolve by translating the value OR (if intentional) copy the exact value into tools/ci/i18n-script-purity-accepted.json under "${locale}".`
			);
		}

		console.log("-");
	}
} catch (error) {
	hasFailures = true;
	console.error(String(error?.message || error));
}

// write report file for downstream tooling
try {
	const outPath = join(repoRoot, "tmp", "compare-report.json");
	// ensure tmp dir exists (best-effort)
	try {
		const fs = await import("fs");
		fs.mkdirSync(dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
		console.log(`wrote ${outPath}`);
	} catch (e) {
		console.error(`Failed to write compare-report.json: ${String(e)}`);
	}
} catch (err) {
	console.error(String(err));
}

process.exitCode = hasFailures ? 1 : 0;
