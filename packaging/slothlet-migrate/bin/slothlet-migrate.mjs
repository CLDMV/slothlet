#!/usr/bin/env node
/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /packaging/slothlet-migrate/bin/slothlet-migrate.mjs
 *	@Date: 2026-11-16T16:15:10-08:00 (1794874510)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:28:23-08:00 (1794875303)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `slothlet-migrate` CLI: dry run by default (prints a diff and every finding);
 * `--write` applies the rewrites.
 * @module @cldmv/slothlet-migrate/bin
 */

import { resolve } from "node:path";
import { collectFiles, migrateFile } from "../src/index.mjs";

const HELP = `Usage: slothlet-migrate [options] [paths...]

Rewrites slothlet v3 code, configs and slothlet.module.json files to v4.
Without --write nothing is changed: the diff and the findings are printed.

Paths are files or folders (default: the current folder). Folders are searched
for .js / .mjs / .cjs files, slothlet.module.json and package.json, skipping
node_modules, dist, coverage and dot-folders. TypeScript files are listed, not
rewritten.

Options:
  --write            apply the rewrites
  --config <file>    also migrate <file> as a slothlet config JSON (repeatable)
  --callee <name>    treat <name>(config) like slothlet(config) (repeatable)
  --json             print the results as JSON
  --no-diff          do not print diffs
  --no-info          hide behaviour notes (findings that need no edit)
  -h, --help         show this help

Findings:
  rewrite   changed in place (or would be, in a dry run)
  manual    needs a hand edit: the tool could not prove the change
  info      a v4 behaviour change to check; nothing to edit
`;

/**
 * Parse argv.
 * @param {string[]} argv - Arguments.
 * @returns {object} Options.
 */
function parseArgs(argv) {
	const opts = { paths: [], write: false, configs: [], callees: [], json: false, diff: true, info: true, help: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--write") opts.write = true;
		else if (a === "--json") opts.json = true;
		else if (a === "--no-diff") opts.diff = false;
		else if (a === "--no-info") opts.info = false;
		else if (a === "-h" || a === "--help") opts.help = true;
		else if (a === "--config" || a === "--callee") {
			const value = argv[++i];
			if (!value) throw new Error(`${a} needs a value`);
			(a === "--config" ? opts.configs : opts.callees).push(value);
		} else if (a.startsWith("--config=")) opts.configs.push(a.slice(9));
		else if (a.startsWith("--callee=")) opts.callees.push(a.slice(9));
		else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
		else opts.paths.push(a);
	}
	return opts;
}

/**
 * Run the CLI.
 * @param {string[]} argv - Arguments.
 * @returns {number} Exit code.
 */
function main(argv) {
	let opts;
	try {
		opts = parseArgs(argv);
	} catch (error) {
		process.stderr.write(`slothlet-migrate: ${error.message}\n\n${HELP}`);
		return 2;
	}
	if (opts.help) {
		process.stdout.write(HELP);
		return 0;
	}
	const cwd = process.cwd();
	const configs = new Set(opts.configs.map((c) => resolve(cwd, c)));
	const inputs = (opts.paths.length ? opts.paths : opts.configs.length ? [] : ["."]).map((p) => resolve(cwd, p));
	let collected;
	try {
		collected = collectFiles(inputs, configs);
	} catch (error) {
		process.stderr.write(`slothlet-migrate: ${error.message}\n`);
		return 2;
	}
	const results = [];
	let failed = 0;
	for (const file of collected.files) {
		const res = migrateFile(file, { write: opts.write, cwd, callees: opts.callees, configs });
		if (res.error) failed++;
		results.push(res);
	}
	const shown = (r) => r.findings.filter((f) => opts.info || f.level !== "info");
	if (opts.json) {
		const out = {
			write: opts.write,
			files: results
				.filter((r) => r.changed || r.findings.length || r.error)
				.map((r) => ({ file: r.file, changed: r.changed, error: r.error, findings: shown(r), diff: r.diff })),
			skipped: collected.skipped
		};
		process.stdout.write(`${JSON.stringify(out, null, "\t")}\n`);
		return failed ? 1 : 0;
	}
	const counts = { rewrite: 0, manual: 0, info: 0 };
	for (const r of results) {
		if (r.error) {
			process.stdout.write(`${r.file}: could not parse (${r.error}); skipped\n`);
			continue;
		}
		if (opts.diff && r.diff) process.stdout.write(r.diff);
		for (const f of shown(r)) {
			counts[f.level]++;
			const names = f.old || f.new ? ` ${f.old ?? "(new)"} → ${f.new ?? "removed"}` : "";
			process.stdout.write(`${f.file}:${f.line}:${f.column}  ${f.level.padEnd(7)}${names}\n    ${f.message}\n`);
		}
	}
	const changed = results.filter((r) => r.changed).length;
	process.stdout.write(
		`\n${opts.write ? "Rewrote" : "Would rewrite"} ${changed} file(s): ${counts.rewrite} rewrite(s), ${counts.manual} needing a hand edit, ${counts.info} behaviour note(s).\n`
	);
	if (collected.skipped.length)
		process.stdout.write(
			`${collected.skipped.length} TypeScript file(s) not rewritten (migrate them by hand or run the tool on compiled output).\n`
		);
	if (!opts.write && changed) process.stdout.write("Run again with --write to apply.\n");
	return failed ? 1 : 0;
}

process.stdout.on("error", (error) => {
	if (error.code === "EPIPE") process.exit(process.exitCode ?? 0);
	throw error;
});
process.exitCode = main(process.argv.slice(2));
