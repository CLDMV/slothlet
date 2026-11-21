/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/isolation/helper-import-own-package.test.vitest.mjs
 *	@Date: 2026-11-08T16:46:31-08:00 (1794185191)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:58:45-08:00 (1794185925)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview One file is one module inside an instance within a module's own package too (#715).
 * @description
 * The fixture's api folder sits in a package of its own (`pkg/package.json`, named, with an `imports` field and an
 * `exports` map). Leaf `a` imports the package's helper by a relative path, leaf `b` by the package's `#h` import, leaf
 * `c` by the package's own name. All three resolve into the importing leaf's own package, so all three get the leaf's
 * instance tag (docs/MODULE-STRUCTURE.md, "Helper Modules Are Per Instance"): one evaluation per instance, the same
 * exported object through every spelling inside an instance, and a separate copy for each instance. The same host runs
 * under Node's own loader and under vitest with slothlet inlined and the `slothletInstanceImports()` plugin, two
 * instances in each of eager/lazy × async/live.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIXTURE = path.join(ROOT, "api_tests", "api_test_own_package_imports");
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
	"vitest with slothletInstanceImports()": run([VITEST, "run", "--config", CONFIG], "OWN-PACKAGE ")
};

describe.each(Object.keys(RUNS))("Isolation > one file, one URL within a module's own package (#715) > %s", (name) => {
	const { result, out } = RUNS[name];

	it("runs cleanly", () => {
		expect(result.status).toBe(0);
		expect(out).not.toBeNull();
		expect(Object.keys(out)).toEqual([...CASES, "urls", "tagged"]);
	});

	it("evaluates the helper once per instance", () => {
		expect(out.urls).toEqual(CASES.map(() => "pkg/lib/h.mjs"));
	});

	// vite gives a module's `import.meta.url` without the query of its id, so only Node's own loader shows the tag.
	it.runIf(name === "Node's own loader")("evaluates each copy under an instance's tag", () => {
		expect(out.tagged).toEqual(CASES.map(() => true));
	});

	it.each(CASES)("reaches one exported object by path, by #imports and by the package's own name — %s", (key) => {
		const { byPath, byImports, bySelf } = out[key];
		expect(byPath).toBeGreaterThanOrEqual(0);
		expect({ byImports, bySelf }).toEqual({ byImports: byPath, bySelf: byPath });
	});

	it("gives each instance a copy of its own", () => {
		expect(new Set(CASES.map((key) => out[key].byPath)).size).toBe(CASES.length);
	});
});
