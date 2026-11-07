/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-host-owner-code.test.vitest.mjs
 *	@Date: 2026-11-05T16:50:57-08:00 (1793926257)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T17:47:01-08:00 (1794016021)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The code of the host that created an instance, installed as a package, runs inside a module's call as
 * that call, as the host's own code anywhere else does (#714).
 * @description
 * rummage creates its slothlet instance from `node_modules/@cldmv/rummage/src/ext-host/api-tree.mjs` and hands each
 * extension a context whose closures (`ctx.commands.register` pinning a handler with `lockCaller`, `slothlet.metadata`
 * and `slothlet.event` calls, `host.*` leaves) are written in other files of the same package. The extension's
 * `activate` calls them, so the host's code runs inside the module's call. rummage's files are loaded before slothlet,
 * so slothlet's loader recorded no importer for them.
 *
 * The fixture mirrors that: `owner-host` (under `node_modules`, loaded before slothlet) creates the instance and builds
 * the context in its `context.mjs`. Its code runs as the module whose call it is in, as docs/PERMISSIONS.md ("Code passed
 * by routes slothlet does not see") gives a file no module loaded — the host's own, running its own source — so
 * `lockCaller`, `metadata`, `event` and the host leaf are reached. Two things stay refused: `stranger-pkg`, a package that did not create the instance and that no module
 * imports, building the same closures; and the owner's closures compiled again under the owner file's name from
 * another source.
 *
 * Files are told apart only under Node's own loader (vite transforms the files it loads), so the fixture runs in a
 * child process: `api_tests/api_test_host_owner_code/probe.mjs`.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROBE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_host_owner_code/probe.mjs");
const CONFIGS = ["eager/async", "eager/live", "lazy/async", "lazy/live"];
const CALLS = ["pin", "meta", "emit", "hostLeaf"];

/**
 * What each call of the context gives when the host's code runs as the module's call: `ext.a.activate` may call
 * `lockCaller`, `metadata` and `event` (built-in allows) and the host leaf (the fixture's rule), and `metadata.caller()`
 * inside it is the host, which has no caller path.
 */
const HOST_ANSWERS = {
	pin: { ok: true, value: "function" },
	meta: { ok: true, value: null },
	emit: { ok: true, value: "emitted" },
	hostLeaf: { ok: true, value: "echo:x" }
};

/** What each call gives when the code doing it is no one's. */
const REFUSED = { ok: false, code: "PERMISSION_DENIED", caller: null };

/**
 * The export conditions this worker runs under (`--conditions=x`, or `--conditions x` / `-C x`), so the probe loads
 * the same build of slothlet.
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

describe("Permissions > the code of a host installed as a package, inside a module's call (#714)", () => {
	const result = spawnSync(process.execPath, [...probeConditions(), PROBE], { encoding: "utf8", timeout: 120000 });
	const out = result.status === 0 ? JSON.parse(result.stdout) : {};

	it("runs the probe cleanly", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
		expect(out.ownerFileExists).toBe(true);
		expect(Object.keys(out)).toHaveLength(1 + CONFIGS.length * 3);
	});

	it.each(CONFIGS)("runs the owner package's code as the module's call — %s", (config) => {
		expect(out[`${config}/owner`]).toEqual(HOST_ANSWERS);
	});

	it.each(CONFIGS)("refuses a package that did not create the instance — %s", (config) => {
		expect(out[`${config}/stranger`]).toEqual(Object.fromEntries(CALLS.map((call) => [call, REFUSED])));
	});

	it.each(CONFIGS)("refuses code compiled under the owner file's name from another source — %s", (config) => {
		expect(out[`${config}/forged`]).toEqual(Object.fromEntries(CALLS.map((call) => [call, REFUSED])));
	});
});

describe("Permissions > the same host, with the built-ins slothlet reads replaced after it loaded (#714)", () => {
	// docs/PERMISSIONS.md "Where the source cannot be checked": the built-ins slothlet compares a file's source through are
	// the ones it captured when it loaded. The probe then replaces `process.getBuiltinModule`, the `fs` and `crypto`
	// functions, `TextDecoder`, `URLSearchParams` and the `Map` and `Set` iterators with ones that report the compiled
	// closures' source as the owner file's content (api_tests/api_test_host_owner_code/replace-builtins.mjs), and every
	// answer is the one given without the replacements.
	const result = spawnSync(process.execPath, [...probeConditions(), PROBE, "--replace-builtins"], { encoding: "utf8", timeout: 120000 });
	const out = result.status === 0 ? JSON.parse(result.stdout) : {};

	it("runs the probe cleanly", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
		expect(Object.keys(out)).toHaveLength(1 + CONFIGS.length * 3);
	});

	it.each(CONFIGS)("still runs the owner package's code as the module's call — %s", (config) => {
		expect(out[`${config}/owner`]).toEqual(HOST_ANSWERS);
	});

	it.each(CONFIGS)("still refuses a package that did not create the instance — %s", (config) => {
		expect(out[`${config}/stranger`]).toEqual(Object.fromEntries(CALLS.map((call) => [call, REFUSED])));
	});

	it.each(CONFIGS)("still refuses code compiled under the owner file's name from another source — %s", (config) => {
		expect(out[`${config}/forged`]).toEqual(Object.fromEntries(CALLS.map((call) => [call, REFUSED])));
	});
});
