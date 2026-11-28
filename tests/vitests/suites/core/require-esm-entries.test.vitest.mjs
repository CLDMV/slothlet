/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/require-esm-entries.test.vitest.mjs
 *	@Date: 2026-11-27T21:56:48-08:00 (1795845408)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:40-08:00 (1795869100)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #1034 — a package that imports slothlet statically loads through Node's synchronous `require(esm)`:
 * nothing in slothlet's graph awaits at its top level.
 *
 * @description
 * Fixture: `api_test_require_esm/consumers/*.mjs`, one ESM entry per public entry point of slothlet, each importing
 * it statically, and `require-consumers.cjs`, which `require()`s each of them, `require()`s each public entry point
 * directly (its `default` export condition), and builds an api (whose leaf imports `@cldmv/slothlet/runtime`)
 * through slothlet's CommonJS entry. It runs in a child process under this process's
 * `--conditions`, so it checks `src/` in an ordinary run and `dist/` in a run against the build.
 *
 * @module tests/vitests/suites/core/require-esm-entries
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_REQUIRE_ESM;

/**
 * The export conditions this process resolves with, for the child process to use the same ones.
 * @returns {string[]} The `--conditions` flags.
 */
function conditionFlags() {
	const flags = [];
	const argv = process.execArgv;
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		if (arg.startsWith("--conditions=") || arg.startsWith("-C=")) flags.push(arg);
		else if ((arg === "--conditions" || arg === "-C") && index + 1 < argv.length) flags.push(arg, argv[++index]);
	}
	return flags;
}

describe("require(esm) of packages that import slothlet (#1034)", () => {
	const results = JSON.parse(
		execFileSync(process.execPath, [...conditionFlags(), path.join(DIR, "require-consumers.cjs")], { cwd: DIR, encoding: "utf8" })
	);

	it.each([
		"main.mjs",
		"runtime.mjs",
		"runtime-async.mjs",
		"runtime-live.mjs",
		"errors.mjs",
		"i18n.mjs",
		"files.mjs",
		"sanitize.mjs",
		"typegen.mjs",
		"vite.mjs"
	])("loads an entry importing slothlet's %s with require()", (file) => {
		expect(results[file]).toEqual({ ok: true, names: expect.any(Number) });
		expect(results[file].names).toBeGreaterThan(0);
	});

	it.each([
		"@cldmv/slothlet",
		"@cldmv/slothlet/runtime",
		"@cldmv/slothlet/runtime/async",
		"@cldmv/slothlet/runtime/live",
		"@cldmv/slothlet/errors",
		"@cldmv/slothlet/i18n",
		"@cldmv/slothlet/files",
		"@cldmv/slothlet/sanitize",
		"@cldmv/slothlet/typegen",
		"@cldmv/slothlet/vite"
	])("requires %s directly from CommonJS", (spec) => {
		expect(results[spec]).toEqual({ ok: true, names: expect.any(Number) });
		expect(results[spec].names).toBeGreaterThan(0);
	});

	it("builds an api from CommonJS whose leaves import the runtime", () => {
		expect(results.api).toEqual({ ok: true, sum: 5, self: true });
	});
});
