/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-plain-node-named-compile.test.vitest.mjs
 *	@Date: 2026-11-17T04:54:31-08:00 (1794920071)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:36-08:00 (1795869156)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Outside vitest, code compiled under the name of a module file the instance is loading is that file's
 * code, whoever compiles it, from the first compile on.
 *
 * vitest without the slothlet plugin leaves the first runner-shaped compile of each load to the code making it, since
 * no worker setup records what vitest's server sends. Plain Node has no module runner: a leaf whose rules open
 * `capability:code`, compiling under a loading file's tagged name, is refused on its first compile as on every later
 * one, as the loading file's own code would be. The run happens in a plain Node process of its own, since this test
 * runs inside a vitest worker.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const SCRIPT = path.join(ROOT, "api_tests", "api_test_plain_node_named_compile", "run.mjs");
const CONFIGS = ["eager/async", "eager/live", "lazy/async", "lazy/live"];

/**
 * The environment for the plain Node process: this worker's, without the variables that tell a process it is a vitest
 * worker.
 * @returns {Record<string, string>} The environment.
 */
function childEnv() {
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (key.startsWith("VITEST") || key === "TINYPOOL_WORKER_ID") delete env[key];
	return env;
}

describe("a compile under a loading file's name in plain Node", () => {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", SCRIPT], {
		cwd: ROOT,
		env: childEnv(),
		encoding: "utf8",
		timeout: 120000
	});
	const line = String(result.stdout)
		.split("\n")
		.find((text) => text.startsWith("PLAIN-NAMED-COMPILE "));
	const out = line ? JSON.parse(line.slice("PLAIN-NAMED-COMPILE ".length)) : {};

	it("runs the plain Node script cleanly", () => {
		expect(line).toBeDefined();
		expect(result.status).toBe(0);
		expect(Object.keys(out)).toHaveLength(CONFIGS.length);
	});

	it.each(CONFIGS)("is refused as the loading file's code on the first compile, not left to its caller — %s", (config) => {
		expect(out[config]).toEqual({
			tagged: true,
			first: "PERMISSION_CAPABILITY_REFUSED",
			second: "PERMISSION_CAPABILITY_REFUSED",
			unnamed: "done",
			loaded: true,
			ran: null
		});
	});
});
