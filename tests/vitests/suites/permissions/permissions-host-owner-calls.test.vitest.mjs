/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-host-owner-calls.test.vitest.mjs
 *	@Date: 2026-11-06T05:59:23-08:00 (1793973563)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T15:40:35-08:00 (1794008435)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host's own leaves and hooks, called inside a module's call, under Node's own loader (#714).
 * @description
 * The host package (`owner-host`, loaded before slothlet as rummage is) mounts its own leaves under `host` and installs
 * an `around` hook. Each answer is the one docs/PERMISSIONS.md and docs/HOOKS.md give, lazy equal to eager, in both
 * runtimes:
 *
 * - a module hands the host's record leaf (`host.records.apply`) a callback, so the leaf's call is one handed code; the
 *   host's code inside it, a frame no call of the chain can be placed on, is taken to be the caller's, with the leaf as
 *   its ceiling ("Code a caller hands to a leaf runs as the caller"). The rules let `host.records.**` open a store
 *   partition and do not let `ext.b.work`, so the partition is refused, as `ext.b.work`;
 * - the host's hook on a module leaf is a hook the host registered, so it is not pinned and runs during the call it
 *   intercepts ("Caller Identity in Callbacks"); its helper in another of the host's files is the host's own code
 *   running its own source, so `lockCaller` (a built-in allow) pins the argument;
 * - a module's helper outside its api folder, imported by its leaf, is that module's code ("Code passed by routes
 *   slothlet does not see": a module's own dependency runs as that module), so it reaches the host leaf the rules let
 *   `ext.**` call.
 *
 * The fixture runs in a child process: `api_tests/api_test_host_owner_code/probe-host-calls.mjs`.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROBE = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../../../api_tests/api_test_host_owner_code/probe-host-calls.mjs"
);
const CONFIGS = ["eager/async", "eager/live", "lazy/async", "lazy/live"];

/**
 * The export conditions this worker runs under, so the probe loads the same build of slothlet.
 * @returns {string[]} The conditions, as `--conditions=x` arguments.
 */
function probeConditions() {
	const conditions = [];
	process.execArgv.forEach((arg, index, all) => {
		if (arg.startsWith("--conditions=")) conditions.push(arg);
		else if ((arg === "--conditions" || arg === "-C") && all[index + 1]) conditions.push(`--conditions=${all[index + 1]}`);
	});
	return conditions;
}

describe("Permissions > the host's own leaves and hooks inside a module's call, under Node's own loader (#714)", () => {
	const result = spawnSync(process.execPath, [...probeConditions(), PROBE], { encoding: "utf8", timeout: 120000 });
	const out = result.status === 0 ? JSON.parse(result.stdout) : {};

	it("runs the probe cleanly", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
		expect(Object.keys(out)).toHaveLength(CONFIGS.length * 3);
	});

	it.each(CONFIGS)("runs the host's code inside a record leaf handed a callback as the caller, under the leaf — %s", (config) => {
		expect(out[`${config}/records`]).toEqual({ ok: false, code: "PERMISSION_DENIED", caller: "ext.b.work" });
	});

	it.each(CONFIGS)("runs a module's helper outside its api folder as the module's call — %s", (config) => {
		expect(out[`${config}/helper`]).toEqual({ ok: true, value: "echo:helper" });
	});

	it.each(CONFIGS)("runs the host's unpinned hook and its helper file within the call it intercepts — %s", (config) => {
		expect(out[`${config}/hook`]).toEqual({ ok: true, value: "function" });
	});
});
