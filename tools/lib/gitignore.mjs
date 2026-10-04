/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/lib/gitignore.mjs
 *	@Date: 2026-09-27 23:12:05 -07:00 (1790575925)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:51 -07:00 (1791083091)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `.gitignore` matching for the repo's own file scanners.
 *
 * @description
 * The dev/CI scanners (`tools/dev/analyze-errors.mjs`, `tools/ci/check-i18n-languages.mjs`) walk the
 * source tree themselves. This lets them skip whatever the project's `.gitignore` excludes — scratch,
 * caches, build output — and prune an ignored directory before descending into it, instead of each
 * scanner keeping its own hard-coded list. Matching uses the `ignore` package, the same matcher
 * `@cldmv/fix-headers` uses, so all the header/quality tools agree on what is ignored.
 *
 * @module tools/lib/gitignore
 */

import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ignore from "ignore";

/**
 * Build a predicate that reports whether a path is excluded by `<rootDir>/.gitignore`.
 * A missing `.gitignore` yields a predicate that ignores nothing.
 * @param {string} rootDir - Absolute repository root (where `.gitignore` lives).
 * @returns {(absPath: string, isDirectory?: boolean) => boolean} True when the path is gitignored.
 * Pass `isDirectory: true` for a folder so directory-only patterns (`tmp/`) match it.
 * @example
 * const isIgnored = loadGitignore(rootDir);
 * isIgnored(join(rootDir, "tmp"), true); // true
 */
export function loadGitignore(rootDir) {
	let content;
	try {
		content = readFileSync(join(rootDir, ".gitignore"), "utf8");
	} catch {
		return () => false;
	}
	const matcher = ignore().add(content);
	return (absPath, isDirectory = false) => {
		const rel = relative(rootDir, absPath).split(sep).join("/");
		// Paths outside the root (or the root itself) are never matched — `ignore` rejects them.
		if (rel.length === 0 || rel.startsWith("..")) return false;
		return matcher.ignores(isDirectory ? `${rel}/` : rel);
	};
}
