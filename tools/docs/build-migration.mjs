/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/docs/build-migration.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Generates the tables in docs/MIGRATION.md from the migrate package's shipped data
 * (packaging/slothlet-migrate/data/{mapping,codes,extras,audit}.json).
 *
 * Each table lives between a pair of marker comments:
 *
 *   <!-- migration-table:<id>:start -->
 *   ...generated...
 *   <!-- migration-table:<id>:end -->
 *
 * Everything outside the markers is hand-written and left alone. The output is run through the repo's prettier config, so the
 * result is stable: running it twice changes nothing.
 *
 * Usage:
 *   node tools/docs/build-migration.mjs           rewrite the tables in docs/MIGRATION.md
 *   node tools/docs/build-migration.mjs --check   exit 1 when docs/MIGRATION.md is out of sync with the data
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = join(root, "packaging", "slothlet-migrate", "data");
const guidePath = join(root, "docs", "MIGRATION.md");

/**
 * Read one of the migrate package's data files; a missing optional file reads as null.
 * @param {string} name - File name inside the data folder.
 * @param {boolean} [optional] - Return null instead of throwing when the file is absent.
 * @returns {object|null} The parsed JSON.
 */
function readData(name, optional = false) {
	const file = join(dataDir, name);
	if (!existsSync(file)) {
		if (optional) return null;
		throw new Error(`build-migration: missing ${file}`);
	}
	return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * Escape a value for a markdown table cell.
 * @param {string} text - Cell text.
 * @returns {string} Text safe inside a table cell.
 */
function cell(text) {
	return String(text)
		.replace(/[\\|*_<>]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "\\" + c))
		.replace(/\s*\n\s*/g, " ")
		.trim();
}

/**
 * Wrap a name in a code span for a table cell.
 * @param {string|null} name - Name, or null for "none".
 * @returns {string} A code span, or an em dash for null.
 */
function code(name) {
	if (name === null || name === undefined || name === "") return "—";
	// Backslashes first, so the escape added for a pipe is not itself escaped.
	return "`" + String(name).replace(/\\/g, "\\\\").replace(/\|/g, "\\|") + "`";
}

/**
 * Render a markdown table.
 * @param {string[]} head - Column headings.
 * @param {string[][]} rows - Row cells, already escaped.
 * @returns {string} The table, or a one-line note when there are no rows.
 */
function table(head, rows) {
	if (rows.length === 0) return "_Nothing in this group._";
	const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
	for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
	return lines.join("\n");
}

const ACTION_LABEL = {
	rename: "renamed",
	move: "moved",
	remove: "removed",
	new: "new",
	fold: "folded",
	behaviour: "behaviour"
};

/**
 * Build the rows of one mapping kind.
 * @param {object[]} entries - Every mapping entry.
 * @param {string} kind - The kind to render.
 * @returns {string} A table with columns v3, v4, change and notes.
 */
function kindTable(entries, kind) {
	const rows = entries
		.filter((e) => e.kind === kind)
		.map((e) => [code(e.old), code(e.new), ACTION_LABEL[e.action] ?? e.action, cell(e.note ?? "")]);
	return table(["v3", "v4", "Change", "Notes"], rows);
}

/**
 * Build the table of everything v4 removes, with what to use instead.
 * @param {object[]} entries - Every mapping entry (plus extras).
 * @returns {string} A table with columns kind, removed and replacement.
 */
function removedTable(entries) {
	const rows = entries.filter((e) => e.action === "remove" && e.kind !== "internal").map((e) => [e.kind, code(e.old), cell(e.note ?? "")]);
	return table(["Kind", "Removed", "Use instead"], rows);
}

/**
 * Build the table of permission-rule target renames, derived from the method rows. A rule target is a method path without the
 * leading `api.`, so every method that is renamed, moved or folded renames its rule target too.
 * @param {object[]} entries - Every mapping entry.
 * @returns {string} A table with columns v3 target and v4 target.
 */
function ruleTargetTable(entries) {
	const strip = (p) => p.replace(/^api\./, "");
	const rows = entries
		.filter((e) => e.kind === "method" && ["rename", "move", "fold"].includes(e.action) && e.new && e.old.startsWith("api."))
		.map((e) => [code(strip(e.old)), code(strip(e.new))]);
	return table(["v3 rule target", "v4 rule target"], rows);
}

/**
 * Build the error and warning code table.
 * @param {object} codes - Contents of codes.json.
 * @returns {string} Two tables: renamed codes, then codes that no longer exist.
 */
function codesTable(codes) {
	const renamed = Object.entries(codes.renamed).map(([from, to]) => [code(from), code(to)]);
	const removed = (codes.removed ?? []).map((c) => [code(c)]);
	return [table(["v3 code", "v4 code"], renamed), "", "Codes that no longer exist:", "", table(["Removed code"], removed)].join("\n");
}

/**
 * Build the table of data keys a program reads off slothlet objects: audit.json scopes (when present) plus extras.json entries.
 * @param {object|null} audit - Contents of audit.json, or null before it ships.
 * @param {object} extras - Contents of extras.json.
 * @returns {string} A table with columns where, v3 key, v4 key and notes.
 */
function dataTable(audit, extras) {
	const rows = [];
	for (const scope of Object.values(audit?.scopes ?? {})) {
		for (const [from, to] of Object.entries(scope.keys)) {
			const target = typeof to === "string" ? { to, note: "" } : to;
			rows.push([cell(scope.label), code(from), code(target.to), cell(target.note ?? "")]);
		}
	}
	for (const e of extras.entries ?? []) {
		rows.push(["error / warning", code(e.old), code(e.new), cell(e.note ?? "")]);
	}
	return table(["Where", "v3 key", "v4 key", "Notes"], rows);
}

/**
 * Render every generated table.
 * @returns {Record<string, string>} Table id to markdown.
 */
export function renderTables() {
	const mapping = readData("mapping.json");
	const codes = readData("codes.json");
	const extras = readData("extras.json");
	const audit = readData("audit.json", true);
	const entries = mapping.entries;
	const all = [...entries, ...(extras.entries ?? [])];
	return {
		config: kindTable(entries, "config"),
		option: kindTable(entries, "option"),
		method: kindTable(entries, "method"),
		export: kindTable(entries, "export"),
		manifest: kindTable(entries, "manifest"),
		cli: kindTable(entries, "cli"),
		"node-field": kindTable(entries, "node-field"),
		codes: codesTable(codes),
		data: dataTable(audit, extras),
		removed: removedTable(all),
		"rule-targets": ruleTargetTable(entries),
		internal: kindTable(entries, "internal")
	};
}

/**
 * Replace the content between each pair of markers with its generated table.
 * @param {string} guide - Current guide text.
 * @param {Record<string, string>} tables - Table id to markdown.
 * @returns {string} The guide with every table regenerated.
 */
function applyTables(guide, tables) {
	let out = guide;
	const seen = new Set();
	for (const [id, md] of Object.entries(tables)) {
		const start = `<!-- migration-table:${id}:start -->`;
		const end = `<!-- migration-table:${id}:end -->`;
		const a = out.indexOf(start);
		const b = out.indexOf(end);
		if (a === -1 || b === -1 || b < a) throw new Error(`build-migration: docs/MIGRATION.md has no marker pair for "${id}"`);
		out = out.slice(0, a + start.length) + "\n\n" + md + "\n\n" + out.slice(b);
		seen.add(id);
	}
	for (const m of guide.matchAll(/<!-- migration-table:([\w-]+):start -->/g)) {
		if (!seen.has(m[1])) throw new Error(`build-migration: marker "${m[1]}" in docs/MIGRATION.md has no generator`);
	}
	return out;
}

/**
 * Format markdown with the repo's prettier config so the generated file passes `format:check` unchanged.
 * @param {string} text - Markdown.
 * @returns {Promise<string>} Formatted markdown.
 */
async function format(text) {
	const options = (await prettier.resolveConfig(guidePath, { config: join(root, ".configs", ".prettierrc") })) ?? {};
	return prettier.format(text, { ...options, filepath: guidePath });
}

/**
 * Entry point.
 * @returns {Promise<void>}
 */
async function main() {
	const check = process.argv.includes("--check");
	const current = readFileSync(guidePath, "utf8");
	const next = await format(applyTables(current, renderTables()));
	if (next === current) {
		console.log("docs/MIGRATION.md is in sync with packaging/slothlet-migrate/data");
		return;
	}
	if (check) {
		console.error(
			"docs/MIGRATION.md is out of sync with packaging/slothlet-migrate/data. Run `npm run docs:migration` and commit the result."
		);
		process.exitCode = 1;
		return;
	}
	writeFileSync(guidePath, next);
	console.log("docs/MIGRATION.md tables regenerated");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
