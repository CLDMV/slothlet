/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/internal-resolve.mjs
 *	@Date: 2026-07-20 10:04:22 -07:00 (1784567062)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-20 10:10:05 -07:00 (1784567405)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Middle-man resolver for reaching slothlet internals from tests in a way that works
 * whether the SOURCE tree is present or has been stripped.
 *
 * The CI build removes `src/` after building (`ci-cleanup-src`), so the post-build coverage phase runs
 * against `dist/` only — the same situation an installed consumer is in. `.configs/vitest.config.mjs`
 * and `tests/test-conditional.mjs` already switch the `@cldmv/slothlet/*` resolution condition on this
 * signal. Tests must not hard-code `../../../src/...` relative paths (they break the moment `src/` is
 * gone). Instead:
 *
 *   - Public surface → import the package export, e.g. `@cldmv/slothlet/helpers/module-sort`.
 *   - Internals with a package `imports` mapping → the `#handlers/*` / `#factories/*` specifiers, which
 *     already detect src vs dist via conditions (they were removed from `exports` for the permission
 *     boundary in v3.12.0).
 *   - Anything else an internal test needs (importing an internal with no `#` mapping, or READING a
 *     source file for static analysis) → this module: `hasSource`, `internalLibPath`, `importInternal`.
 *
 * @module tests/vitests/setup/internal-resolve
 * @internal
 */

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

/**
 * `true` when the source tree is present (local dev, pre-build CI); `false` once `ci-cleanup-src` has
 * removed `src/` and only `dist/` remains. Matches the `src/slothlet.mjs` probe used by the vitest
 * config and `tests/test-conditional.mjs`. Source-only tests (e.g. static analysis of un-minified code)
 * should `describe.skipIf(!hasSource)`.
 */
export const hasSource = existsSync(path.join(repoRoot, "src/slothlet.mjs"));

// Active library tree: `src/lib` when source is present, else the built `dist/lib`.
const libBase = path.join(repoRoot, hasSource ? "src/lib" : "dist/lib");

/**
 * Absolute path to a lib-internal file in the active (src or dist) tree — for READING it (readFileSync).
 * @param {string} rel - Path under `lib/`, e.g. `"processors/flatten.mjs"`.
 * @returns {string} Absolute filesystem path.
 */
export function internalLibPath(rel) {
	return path.join(libBase, rel);
}

/**
 * Dynamically import a lib-internal module from the active (src or dist) tree — the middle-man for an
 * internal that has no package export and no `#` mapping. Prefer `#handlers/*` / `#factories/*` where
 * they exist; use this only for internals without one.
 * @param {string} rel - Path under `lib/`, e.g. `"processors/flatten.mjs"`.
 * @returns {Promise<object>} The imported module namespace.
 */
export function importInternal(rel) {
	return import(pathToFileURL(path.join(libBase, rel)).href);
}
