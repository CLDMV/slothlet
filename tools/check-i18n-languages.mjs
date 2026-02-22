/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/check-i18n-languages.mjs
 *	@Date: 2026-02-22
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
	return join(toolDir, "..");
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
 * Parse CLI args.
 * @param {string[]} argv - Process argv.
 * @returns {{ languagesDir?: string }} Parsed options.
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

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolveRepoRoot();
const languagesDir = args.languagesDir ? args.languagesDir : resolveLanguagesDir(repoRoot);

const baseLocale = "en-us";
const basePath = join(languagesDir, `${baseLocale}.json`);

let hasFailures = false;

try {
	const baseJson = parseJsonFile(basePath);
	const baseKeys = getTranslationKeys(baseJson, baseLocale);

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

		if (missing.length === 0 && extra.length === 0) {
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
			console.log(`${locale}: EXTRA ${extra.length}`);
			for (const key of extra) console.log(`  + ${key}`);
		}

		console.log("-");
	}
} catch (error) {
	hasFailures = true;
	console.error(String(error?.message || error));
}

process.exitCode = hasFailures ? 1 : 0;
