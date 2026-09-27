/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/test-fixtures-tmp.mjs
 *	@Date: 2026-09-26 23:36:21 -07:00 (1790490981)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-27 00:06:32 -07:00 (1790492792)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Scratch directories for test suites, under the repo's `tmp/test-fixtures/`.
 *
 * @description
 * Every directory a test creates at runtime — copied fixtures, generated modules, cache roots —
 * comes from here, never from `os.tmpdir()`. Each is named `<pid>-<label>-XXXXXX`: the leading PID
 * is what lets the precheck in `tests/lib/clean-tmp-artifacts.mjs` remove a directory whose run
 * crashed or was killed, while never touching one that belongs to a run still in progress. Suites
 * remove their own directories when they finish; the precheck is the backstop.
 *
 * The one exception is a test that needs a location with NO `package.json` anywhere above it (the
 * TypeScript processor's package-root fallback): the repo root has one, so such a test has to use
 * the system temp directory and must remove what it creates.
 *
 * @module tests/vitests/setup/test-fixtures-tmp
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path of `tmp/test-fixtures/` in the repo.
 * @type {string}
 */
export const TEST_FIXTURES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tmp/test-fixtures");

/**
 * The `mkdtemp` prefix for a label: `<root>/<pid>-<label>-`.
 * @param {string} label - Short name of what the directory holds (e.g. `"ownership"`).
 * @returns {string} The prefix to hand to `mkdtemp`.
 * @private
 */
const prefixFor = (label) => path.join(TEST_FIXTURES_ROOT, `${process.pid}-${label}-`);

/**
 * Create a unique scratch directory under `tmp/test-fixtures/`.
 * @param {string} label - Short name of what the directory holds.
 * @returns {Promise<string>} Absolute path of the new directory.
 * @example
 * const root = await makeTestTmpDir("typegen");
 */
export async function makeTestTmpDir(label) {
	await fsp.mkdir(TEST_FIXTURES_ROOT, { recursive: true });
	return fsp.mkdtemp(prefixFor(label));
}

/**
 * Synchronous {@link makeTestTmpDir}.
 * @param {string} label - Short name of what the directory holds.
 * @returns {string} Absolute path of the new directory.
 * @example
 * const root = makeTestTmpDirSync("ownership");
 */
export function makeTestTmpDirSync(label) {
	fs.mkdirSync(TEST_FIXTURES_ROOT, { recursive: true });
	return fs.mkdtempSync(prefixFor(label));
}
