/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-stack-settings-fixed.test.vitest.mjs
 *	@Date: 2026-11-15T23:41:50-08:00 (1794814910)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:09-08:00 (1794882609)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that fixes the global stack settings in place changes nothing for anyone else.
 *
 * @description
 * Fixture `api_test_stack_settings`, run in a process of its own per change (`child-fixed.mjs`): `settler` makes
 * `Error.stackTraceLimit` or `Error.prepareStackTrace` read-only and non-configurable, puts a fixed stand-in on the
 * global `Error`; or the host does the same to the realm slothlet reads stacks from, reached through the call sites
 * slothlet's exported reader hands it (`ownRealm`: slothlet then reads from a new realm of its own). slothlet reads call stacks from a source module code cannot reach, so afterwards each step answers as
 * with nothing changed: `good` still calls the node only it may call, `settler` is still refused the vault, and the
 * host's own listeners, stream writes and timers work.
 *
 * Under vitest with the `slothletInstanceImports()` plugin (#714), the host's own files vite evaluates after the settings
 * were fixed still register: the late-files fixture runs in a vitest of its own (`vitest.fixed.config.mjs`) with
 * `Error.prepareStackTrace` and `Error.stackTraceLimit` fixed in place before its late imports, and gives the answers
 * `permissions-vite-late-files` gives with nothing changed.
 * @module tests/vitests/suites/permissions/permissions-stack-settings-fixed
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { describe, it, expect } from "vitest";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_stack_settings");
const FIXED = ["fixedLimit", "fixedPrepare", "fixedGlobal", "ownRealm"];
const EXPECTED = {
	good: "GOOD-ONLY",
	goodLater: "GOOD-ONLY",
	settler: "PERMISSION_DENIED",
	handedToGood: "PERMISSION_DENIED",
	hostListener: "heard",
	hostStream: "written",
	hostTimer: "ran"
};

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Run the steps with one change fixed in place, in a child process.
 * @param {string[]} args - The change and the config.
 * @returns {object} The answers.
 */
function child(args) {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", path.join(FIXTURE, "child-fixed.mjs"), ...args], {
		encoding: "utf8",
		timeout: 120_000
	});
	const line = result.stdout.split("\n").find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`child gave no result (status ${result.status}): ${result.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe.each(matrix)("stack settings fixed in place by a module > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	it.each(FIXED)(
		"%s: everyone else answers as with nothing changed",
		(change) => {
			const { keep, ...answers } = child([change, mode, runtime, attribution, "true"]);
			expect(keep).toBeUndefined();
			expect(answers).toEqual(EXPECTED);
		},
		180_000
	);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const LATE_FIXTURE = path.join(ROOT, "api_tests", "api_test_vite_late_files");
const LATE_CONFIGS = ["eager/async", "eager/live", "lazy/async", "lazy/live"];
/** What each call of a host-built context gives when the host's code runs as the module's call. */
const HOST_ANSWERS = {
	pin: { ok: true, value: "function" },
	meta: { ok: true, value: null },
	emit: { ok: true, value: "emitted" },
	hostLeaf: { ok: true, value: "echo:x" }
};

/**
 * Run the late-files fixture in a vitest of its own, with the stack settings fixed in place, and read what it printed.
 * @returns {{status: number|null, out: Record<string, unknown>|null, stderr: string}} The child's status and answers.
 */
function lateCallsFixed() {
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (key.startsWith("VITEST") || key === "TINYPOOL_WORKER_ID") delete env[key];
	const result = spawnSync(
		process.execPath,
		[
			"--conditions=slothlet-dev",
			path.join(ROOT, "node_modules", "vitest", "vitest.mjs"),
			"run",
			"--config",
			path.join(LATE_FIXTURE, "vitest", "vitest.fixed.config.mjs")
		],
		{ cwd: ROOT, env, encoding: "utf8", timeout: 300_000 }
	);
	const line = stripVTControlCharacters(String(result.stdout))
		.split("\n")
		.find((text) => text.startsWith("LATE-CALLS "));
	return { status: result.status, out: line ? JSON.parse(line.slice("LATE-CALLS ".length)) : null, stderr: String(result.stderr) };
}

describe("stack settings fixed in place > host files vite evaluates afterwards (#714)", () => {
	it("register, and run as Node's own loader runs them", () => {
		const { status, out, stderr } = lateCallsFixed();
		expect(out, stderr).not.toBeNull();
		expect(status).toBe(0);
		for (const config of LATE_CONFIGS) {
			expect(out[`${config}/late`], config).toEqual(HOST_ANSWERS);
			expect(out[`${config}/importing`], config).toEqual(HOST_ANSWERS);
			expect(out[`${config}/handed`], config).toEqual({ ok: true, value: "caller.setup" });
			expect(out[`${config}/json`], config).toEqual({ ok: true, value: "late-files-manifest" });
		}
	}, 320_000);
});
