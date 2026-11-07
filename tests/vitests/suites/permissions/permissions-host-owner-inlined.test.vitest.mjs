/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-host-owner-inlined.test.vitest.mjs
 *	@Date: 2026-11-06T05:59:23-08:00 (1793973563)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T22:14:34-08:00 (1794032074)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A host set up like rummage under vitest (#714): its package, and slothlet, run through vitest's module
 * runner (`server.deps.inline`) with no slothlet plugin configured, and attribution comes out as it does under Node's own
 * loader for every file vitest's runner recorded before slothlet loaded.
 * @description
 * The fixture's vitest (`api_tests/api_test_host_owner_code/vitest/`) runs in a child process of its own, with only
 * `server.deps.inline`. Each answer is the one docs/PERMISSIONS.md gives under Node's own loader, as the plain-Node
 * suites (`permissions-host-owner-code`, `permissions-host-owner-calls`) assert it, lazy equal to eager, in both
 * runtimes ("Where the source cannot be checked": slothlet reads vitest's records once, when it loads, and never again):
 *
 * - the context the owner package hands a module (`lockCaller`, `metadata`, `event`, a host leaf) is reached: the
 *   host's own file running its own source runs as the module's call ("Code passed by routes slothlet does not see");
 * - the host's code inside its record leaf, handed a callback, runs as the caller under the leaf ("Code a caller hands
 *   to a leaf runs as the caller"), so the store partition only `host.records.**` may open is refused, as `ext.b.work`;
 * - the host's unpinned `around` hook pins a module leaf's function argument through a helper of another of its files
 *   (docs/HOOKS.md, "Caller Identity in Callbacks");
 * - a module's helper outside its api folder, which vite evaluates after slothlet loads, has no record taken, so it is
 *   refused here; attributing a module's code under vitest is #682;
 * - a package that did not create the instance, imported by the host's code, is a file no module loaded, so it runs as
 *   the module's call as well, as under Node's own loader once slothlet is loaded.
 *
 * The owner's closures compiled with `vm` under its file's name stay refused: code compiled under a name, holding
 * another source, is no one's, and no record made after slothlet loaded vouches for it.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONFIG = path.join(ROOT, "api_tests", "api_test_host_owner_code", "vitest", "vitest.config.mjs");
const VITEST = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
const CONFIGS = ["eager/async", "eager/live", "lazy/async", "lazy/live"];
const CALLS = ["pin", "meta", "emit", "hostLeaf"];
const HOST_ANSWERS = {
	pin: { ok: true, value: "function" },
	meta: { ok: true, value: null },
	emit: { ok: true, value: "emitted" },
	hostLeaf: { ok: true, value: "echo:x" }
};
const REFUSED = Object.fromEntries(CALLS.map((call) => [call, { ok: false, code: "PERMISSION_DENIED", caller: null }]));

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

describe("Permissions > a host like rummage's under vitest, with only server.deps.inline (#714)", () => {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", VITEST, "run", "--config", CONFIG], {
		cwd: ROOT,
		env: childEnv(),
		encoding: "utf8",
		timeout: 300000
	});
	// With colour forced (FORCE_COLOR; CI runs coloured), the reporter writes escape codes before the printed line.
	const line = stripVTControlCharacters(String(result.stdout))
		.split("\n")
		.find((text) => text.startsWith("HOST-CALLS "));
	const out = line ? JSON.parse(line.slice("HOST-CALLS ".length)) : {};

	it("runs the fixture's vitest cleanly", () => {
		expect(line).toBeDefined();
		expect(result.status).toBe(0);
		expect(Object.keys(out)).toHaveLength(CONFIGS.length * 6);
	});

	it.each(CONFIGS)("runs the owner package's context as the module's call — %s", (config) => {
		expect(out[`${config}/owner`]).toEqual(HOST_ANSWERS);
	});

	it.each(CONFIGS)("runs the host's code inside a record leaf handed a callback as the caller, under the leaf — %s", (config) => {
		expect(out[`${config}/records`]).toEqual({ ok: false, code: "PERMISSION_DENIED", caller: "ext.b.work" });
	});

	it.each(CONFIGS)("refuses a module's helper outside its api folder that vite loads after slothlet (#682) — %s", (config) => {
		// The helper is evaluated after slothlet loads, so no record of it is taken (docs/PERMISSIONS.md "Where the source
		// cannot be checked"); attributing a module's code under vitest is #682. The async runtime refuses the access;
		// the live runtime, which tells the running call from the stack, refuses `self` itself ("`self` requires an
		// executing module").
		const code = config.endsWith("/live") ? "RUNTIME_NO_ACTIVE_CONTEXT_SELF" : "PERMISSION_DENIED";
		expect(out[`${config}/helper`]).toEqual({ ok: false, code, caller: null });
	});

	it.each(CONFIGS)("runs the host's unpinned hook and its helper file within the call it intercepts — %s", (config) => {
		expect(out[`${config}/hook`]).toEqual({ ok: true, value: "function" });
	});

	it.each(CONFIGS)("runs a package the host imported as the module's call, as under Node's own loader — %s", (config) => {
		expect(out[`${config}/stranger`]).toEqual(HOST_ANSWERS);
	});

	it.each(CONFIGS)("refuses the owner's closures compiled with vm under its file's name — %s", (config) => {
		expect(out[`${config}/forged`]).toEqual(REFUSED);
	});
});
