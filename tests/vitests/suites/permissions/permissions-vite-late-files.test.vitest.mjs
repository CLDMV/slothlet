/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-vite-late-files.test.vitest.mjs
 *	@Date: 2026-11-06T19:36:17-08:00 (1794022577)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T19:43:17-08:00 (1794022997)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Files vite evaluates after slothlet's runtime loaded, under vitest with the `slothletInstanceImports()`
 * plugin, are attributed as Node's own loader attributes them (#714).
 * @description
 * The fixture's host (`api_tests/api_test_vite_late_files/calls.mjs`) creates the instance and only then imports a
 * package's files and hands their context to a module, as rummage imports an extension's `main`; and one module hands
 * another a plain function of its own, which the other runs later from a call of its own. The same host runs twice, in
 * child processes: under Node's own loader (`probe.mjs`), and under vitest with slothlet in `server.deps.inline` and the
 * plugin configured (`vitest/`). Each answer is the one docs/PERMISSIONS.md gives, lazy equal to eager, in both
 * runtimes, and both runs give it:
 *
 * - a file only the host loaded is the host's own and runs as the module's call it is in ("Code passed by routes
 *   slothlet does not see": only a file no module loaded is the host's own), whether or not it imports another;
 * - another module's function, run by a module's call it was not handed to, runs as the leaf its file was built for,
 *   with that call as its ceiling.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIXTURE = path.join(ROOT, "api_tests", "api_test_vite_late_files");
const CONFIG = path.join(FIXTURE, "vitest", "vitest.config.mjs");
const VITEST = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
const CONFIGS = ["eager/async", "eager/live", "lazy/async", "lazy/live"];

/** What each call of a host-built context gives when the host's code runs as the module's call. */
const HOST_ANSWERS = {
	pin: { ok: true, value: "function" },
	meta: { ok: true, value: null },
	emit: { ok: true, value: "emitted" },
	hostLeaf: { ok: true, value: "echo:x" }
};

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
 * @returns {{result: object, out: Record<string, unknown>|null}} The child's result and what it printed.
 */
function run(args, prefix) {
	const result = spawnSync(process.execPath, [...conditions(), ...args], { cwd: ROOT, env: childEnv(), encoding: "utf8", timeout: 300000 });
	const line = String(result.stdout)
		.split("\n")
		.find((text) => (prefix ? text.startsWith(prefix) : text.startsWith("{")));
	return { result, out: line ? JSON.parse(line.slice(prefix.length)) : null };
}

const RUNS = {
	"Node's own loader": run([path.join(FIXTURE, "probe.mjs")], ""),
	"vitest with slothletInstanceImports()": run([VITEST, "run", "--config", CONFIG], "LATE-CALLS ")
};

describe.each(Object.keys(RUNS))("Permissions > files vite evaluates after slothlet loaded (#714) > %s", (name) => {
	const { result, out } = RUNS[name];

	it("runs cleanly", () => {
		expect(result.status).toBe(0);
		expect(out).not.toBeNull();
		expect(Object.keys(out)).toHaveLength(CONFIGS.length * 3);
	});

	it.each(CONFIGS)("runs a file only the host loaded, after the instance existed, as the module's call — %s", (config) => {
		expect(out[`${config}/late`]).toEqual(HOST_ANSWERS);
	});

	it.each(CONFIGS)("runs such a file that imports another as the module's call — %s", (config) => {
		expect(out[`${config}/importing`]).toEqual(HOST_ANSWERS);
	});

	it.each(CONFIGS)(
		"runs another module's function, run by a call it was not handed to, as the leaf its file was built for — %s",
		(config) => {
			expect(out[`${config}/handed`]).toEqual({ ok: true, value: "caller.setup" });
		}
	);
});
