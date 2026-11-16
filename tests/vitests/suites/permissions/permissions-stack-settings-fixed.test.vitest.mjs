/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-stack-settings-fixed.test.vitest.mjs
 *	@Date: 2026-11-15T23:50:00-08:00 (1794815400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T23:50:00-08:00 (1794815400)
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
 * @module tests/vitests/suites/permissions/permissions-stack-settings-fixed
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
