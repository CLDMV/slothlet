/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/audit.mjs
 *	@Date: 2026-11-16T19:01:06-08:00 (1794884466)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:26:22-08:00 (1794929182)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `slothlet-migrate audit`: lists every v3 surface a project still uses, with file, line and
 * the v4 replacement. It runs the rewrite engine without writing (so everything the engine rewrites or
 * reports is listed) and adds audit-only checks for the data a program reads off slothlet objects.
 * @module @cldmv/slothlet-migrate/audit
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { classify, collectFiles, migrateJson, migrateSource } from "./index.mjs";
import { auditData, scopeLabel } from "./lib/audit-data.mjs";
import { parseProgram, position } from "./lib/source.mjs";

/**
 * @typedef {object} AuditFinding
 * @property {string} file - File, relative to the working folder.
 * @property {number} line - 1-based line.
 * @property {number} column - 1-based column.
 * @property {"surface"|"data"} kind - A renamed/removed v3 surface, or a data key read off a slothlet object.
 * @property {"fixable"|"manual"|"info"} level - fixable: `slothlet-migrate --write` rewrites it; manual: needs a hand edit; info: behaviour note (never counts as a finding for the exit code).
 * @property {string} entry - Table row id.
 * @property {string|null} old - v3 name.
 * @property {string|null} new - v4 replacement (null: removed).
 * @property {string} message - What to do.
 */

const LEVELS = { rewrite: "fixable", manual: "manual", info: "info" };

/**
 * Audit one JavaScript source.
 * @param {string} code - Source text.
 * @param {{ filename?: string, callees?: string[] }} [options] - Options.
 * @returns {{ file: string, findings: AuditFinding[], error: string|null }} Findings.
 */
export function auditSource(code, options = {}) {
	const res = migrateSource(code, options);
	if (res.error) return { file: res.file, findings: [], error: res.error };
	const findings = res.findings.map((f) => ({
		file: f.file,
		line: f.line,
		column: f.column,
		kind: "surface",
		level: LEVELS[f.level],
		entry: f.entry,
		old: f.old ?? null,
		new: f.new ?? null,
		message: f.message
	}));
	const { ast } = parseProgram(code);
	const seen = new Set();
	auditData(ast, (offset, scope, old, row) => {
		const key = `${scope}|${old}|${offset}`;
		if (seen.has(key)) return;
		seen.add(key);
		const { line, column } = position(code, offset);
		const to = row.to;
		findings.push({
			file: res.file,
			line,
			column,
			kind: "data",
			level: "manual",
			entry: `audit|${scope}|${old}`,
			old: `${scopeLabel(scope)}: ${old}`,
			new: to,
			message: `${scopeLabel(scope)}: ${old} → ${to ?? "removed"}. ${row.note}`.trim()
		});
	});
	findings.sort((a, b) => a.line - b.line || a.column - b.column || a.entry.localeCompare(b.entry));
	return { file: res.file, findings, error: null };
}

/**
 * Audit one JSON document (config, `slothlet.module.json` or `package.json`).
 * @param {string} text - JSON text.
 * @param {{ filename?: string, kind?: string }} [options] - Options.
 * @returns {{ file: string, findings: AuditFinding[], error: string|null }} Findings.
 */
export function auditJson(text, options = {}) {
	const res = migrateJson(text, options);
	return {
		file: res.file,
		error: res.error,
		findings: res.findings.map((f) => ({
			file: f.file,
			line: f.line,
			column: f.column,
			kind: "surface",
			level: LEVELS[f.level],
			entry: f.entry,
			old: f.old ?? null,
			new: f.new ?? null,
			message: f.message
		}))
	};
}

/**
 * Audit files and folders.
 * @param {string[]} paths - Absolute files or folders.
 * @param {{ cwd?: string, callees?: string[], configs?: Set<string>, info?: boolean }} [options] - Options.
 * @returns {{ findings: AuditFinding[], files: number, errors: { file: string, error: string }[], skipped: string[], counts: { fixable: number, manual: number, info: number } }} Report.
 */
export function audit(paths, options = {}) {
	const cwd = options.cwd ?? process.cwd();
	const configs = options.configs ?? new Set();
	const collected = collectFiles(paths, configs);
	const findings = [];
	const errors = [];
	for (const path of collected.files) {
		const text = readFileSync(path, "utf8");
		const filename = relative(cwd, path) || path;
		const res =
			classify(path, configs) === "json"
				? auditJson(text, { filename, kind: configs.has(path) ? "config" : undefined })
				: auditSource(text, { filename, callees: options.callees });
		if (res.error) errors.push({ file: filename, error: res.error });
		findings.push(...res.findings);
	}
	const counts = { fixable: 0, manual: 0, info: 0 };
	for (const f of findings) counts[f.level]++;
	return {
		findings: options.info ? findings : findings.filter((f) => f.level !== "info"),
		files: collected.files.length,
		errors,
		skipped: collected.skipped.map((p) => relative(cwd, p) || p),
		counts
	};
}
