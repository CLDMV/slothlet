/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/isolation/helper-import-one-url.test.vitest.mjs
 *	@Date: 2026-11-08T15:50:44-08:00 (1794181844)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:02:38-08:00 (1794182558)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview One file is one module inside an instance, however the import is spelled (#715).
 * @description
 * The fixture's helper lives in a package of its own (`shared-lib`), linked into `node_modules` from outside it as a
 * pnpm workspace links a package. Module `a` imports it by a relative path and by a `file:` URL, module `b` by its
 * package name. A file inside a package other than the importer's own stays shared whatever the spelling, as it does
 * when reached by the package's name (docs/MODULE-STRUCTURE.md, "Helper Modules Are Per Instance"), so every route
 * reaches the same module record: one evaluation in the process, the same exported object, and a call through it is
 * attributed to the leaf that made it. The same host runs under Node's own loader and under vitest with slothlet inlined
 * and the `slothletInstanceImports()` plugin, two instances in each of eager/lazy × async/live.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIXTURE = path.join(ROOT, "api_tests", "api_test_shared_helper_import_split");
const CONFIG = path.join(FIXTURE, "vitest", "vitest.config.mjs");
const VITEST = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
const CASES = ["eager/async", "eager/live", "lazy/async", "lazy/live"].flatMap((config) => [`${config}/1`, `${config}/2`]);

/**
 * The export conditions this worker runs under, so the children load the same build of slothlet.
 * @returns {string[]} The conditions, as `--conditions=x` arguments.
 */
function conditions() {
	const found = [];
	process.execArgv.forEach((arg, index, all) => {
		if (arg.startsWith("--conditions=")) found.push(arg);
		else if ((arg === "--conditions" || arg === "-C") && all[index + 1]) found.push(`--conditions=${all[index + 1]}`);
	});
	return found.length ? found : ["--conditions=slothlet-dev"];
}

/**
 * The environment for a child: this worker's, without the variables that tell a process it is already a vitest worker.
 * @returns {Record<string, string>} The environment.
 */
function childEnv() {
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (key.startsWith("VITEST") || key === "TINYPOOL_WORKER_ID") delete env[key];
	return env;
}

/**
 * Run a child and read the JSON line it prints after a prefix.
 * @param {string[]} args - The child's arguments after the conditions.
 * @param {string} prefix - The prefix of the line, or "" for a line that is JSON itself.
 * @returns {{result: object, out: Record<string, any>|null}} The child's result and what it printed.
 */
function run(args, prefix) {
	const result = spawnSync(process.execPath, [...conditions(), ...args], { cwd: ROOT, env: childEnv(), encoding: "utf8", timeout: 300000 });
	// With colour forced (FORCE_COLOR; CI runs coloured), the reporter writes escape codes before the printed line.
	const line = stripVTControlCharacters(String(result.stdout))
		.split("\n")
		.find((text) => (prefix ? text.startsWith(prefix) : text.startsWith("{")));
	return { result, out: line ? JSON.parse(line.slice(prefix.length)) : null };
}

const RUNS = {
	"Node's own loader": run([path.join(FIXTURE, "probe.mjs")], ""),
	"vitest with slothletInstanceImports()": run([VITEST, "run", "--config", CONFIG], "SPLIT-CALLS ")
};

describe.each(Object.keys(RUNS))("Isolation > one file, one URL (#715) > %s", (name) => {
	const { result, out } = RUNS[name];

	it("runs cleanly", () => {
		expect(result.status).toBe(0);
		expect(out).not.toBeNull();
		expect(Object.keys(out)).toEqual([...CASES, "urls"]);
	});

	it("evaluates the helper once, under its own URL, for every route, instance, mode and runtime", () => {
		expect(out.urls).toEqual(["shared-lib/helper.mjs"]);
	});

	it.each(CASES)("reaches the same exported object by path, by file URL and by package name — %s", (key) => {
		expect(out[key]).toMatchObject({ idByPath: 0, idByURL: 0, idByName: 0 });
	});

	it.each(CASES)("attributes a call through the helper to the leaf that made it, whatever the route — %s", (key) => {
		expect(out[key].viaPath).toEqual({ ok: true, value: "a.viaPath" });
		expect(out[key].viaURL).toEqual({ ok: true, value: "a.viaURL" });
		expect(out[key].viaName).toEqual({ ok: true, value: "b.viaName" });
	});
});
