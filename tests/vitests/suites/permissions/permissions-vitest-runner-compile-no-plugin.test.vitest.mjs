/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-vitest-runner-compile-no-plugin.test.vitest.mjs
 *	@Date: 2026-11-17T04:54:31-08:00 (1794920071)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:26:24-08:00 (1794929184)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview vitest's own compile of a module file, with the permission system on, under vitest with no slothlet
 * plugin (only `server.deps.inline`).
 *
 * With no worker setup recording what the vitest server sends, the compile of a loading module file cannot be checked
 * by its code. The first compile of each load is decided by the code making it, as any other code is: vitest's runner
 * is no module's code, so the file loads, as it does under Node's own loader. Module code compiling under the file's
 * name is still refused: its own source under its path or its id, the recorded code replayed with imports it chose,
 * and a fetch reply it changed before vitest's runner read it.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONFIG = path.join(ROOT, "api_tests", "api_test_vitest_runner_compile_no_plugin", "vitest.config.mjs");
const VITEST = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
const CONFIGS = ["eager/async", "eager/live", "lazy/async", "lazy/live"];

/**
 * The environment for the fixture's vitest: this worker's, without the variables that tell a process it is already a
 * vitest worker.
 * @returns {Record<string, string>} The environment.
 */
function childEnv() {
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (key.startsWith("VITEST") || key === "TINYPOOL_WORKER_ID") delete env[key];
	return env;
}

describe("vitest runner compile — no slothlet plugin, only server.deps.inline", () => {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", VITEST, "run", "--config", CONFIG], {
		cwd: ROOT,
		env: childEnv(),
		encoding: "utf8",
		timeout: 300000
	});
	const line = stripVTControlCharacters(String(result.stdout))
		.split("\n")
		.find((text) => text.startsWith("RUNNER-COMPILE "));
	const out = line ? JSON.parse(line.slice("RUNNER-COMPILE ".length)) : {};

	it("runs the fixture's vitest cleanly", () => {
		expect(line).toBeDefined();
		expect(result.status).toBe(0);
		expect(Object.keys(out)).toHaveLength(CONFIGS.length);
	});

	it.each(CONFIGS)("loads a module file and refuses the file's code compiling under its name — %s", (config) => {
		expect(out[config]).toMatchObject({
			runner: true,
			ownCodeAtPath: "PERMISSION_CAPABILITY_REFUSED",
			ownCodeAtId: "PERMISSION_CAPABILITY_REFUSED",
			replay: "PERMISSION_CAPABILITY_REFUSED",
			forged: "PERMISSION_CAPABILITY_REFUSED",
			forgedRan: false,
			replayRan: false,
			selfOwnCode: "PERMISSION_CAPABILITY_REFUSED",
			self: "object"
		});
	});
});
