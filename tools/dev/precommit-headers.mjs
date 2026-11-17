/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/precommit-headers.mjs
 *	@Date: 2026-11-17T00:00:00-08:00 (1794902400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17 00:00:00 -08:00 (1794902400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Pre-commit check: runs `@cldmv/fix-headers` in dry-run mode on the staged files only and
 * exits non-zero when any of them has a missing or malformed header (a stale `@Last modified` stamp alone is ignored). Writes nothing. Run by `npm run precommit:local`.
 * @module @cldmv/slothlet/tools/precommit-headers
 * @internal
 */

import { fixHeaders } from "@cldmv/fix-headers";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FILE_HEADER_CHECK_FOLDERS, FILE_HEADER_IGNORE_FOLDERS, FILE_HEADER_EXTENSIONS } from "../lib/header-config.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Whether a project-relative path is one the header check covers.
 * @internal
 * @param {string} file - Project-relative path with forward slashes.
 * @returns {boolean} True when the file is in a checked folder, has a checked extension and is not ignored.
 * @example
 * isChecked("src/slothlet.mjs"); // true
 */
function isChecked(file) {
	if (!FILE_HEADER_EXTENSIONS.includes(path.extname(file))) return false;
	if (FILE_HEADER_IGNORE_FOLDERS.some((ignored) => file === ignored || file.startsWith(`${ignored}/`))) return false;
	return FILE_HEADER_CHECK_FOLDERS.some(({ path: folder, recursive }) => {
		if (folder === ".") return recursive ? true : !file.includes("/");
		return file.startsWith(`${folder}/`) && (recursive || !file.slice(folder.length + 1).includes("/"));
	});
}

const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { cwd: projectRoot, encoding: "utf8" })
	.split("\n")
	.filter(Boolean)
	.filter(isChecked);

if (staged.length === 0) process.exit(0);

// Inside a hook git exports GIT_INDEX_FILE and friends, which skew fix-headers' own git lookups (dates); run it as a plain checkout.
for (const key of Object.keys(process.env)) if (key.startsWith("GIT_")) delete process.env[key];

const result = await fixHeaders({
	cwd: projectRoot,
	dryRun: true,
	sampleOutput: true, // per-file `sample.issues` is only reported with sample output
	configFile: ".configs/fix-headers.json",
	input: staged
});

// Editing a file always leaves its "Last modified" stamp behind; that refresh is not a missing or malformed header.
const STAMP_FIELDS = new Set(["lastModifiedAt", "lastModifiedBy"]);
const needFix = result.changes
	.filter((c) => c.changed && !(c.sample?.issues?.length > 0 && c.sample.issues.every((i) => STAMP_FIELDS.has(i.field))))
	.map((c) => c.file);
if (needFix.length > 0) {
	console.error("Staged files with a missing or malformed header:");
	for (const file of needFix) console.error(`  ${file}`);
	console.error("Run npm run fix:headers, then re-stage.");
	process.exit(1);
}
