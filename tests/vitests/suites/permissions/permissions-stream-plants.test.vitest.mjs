/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-stream-plants.test.vitest.mjs
 *	@Date: 2026-11-04T19:16:07-08:00 (1793848567)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T19:19:31-08:00 (1793848771)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's code planted inside the internal state of a Node stream it hands out still runs as that
 * module (#708).
 * @description
 * A stream or socket a module hands out comes back as the object itself when only Node's code is on it, and the state
 * Node keeps on it (`_readableState`, `_writableState`, `_events`, its native handle) is not read for the module's
 * code. That is safe because, with `permissions.provenance` on (the default), a module's own function is told apart by
 * the file it was written in wherever it runs. `evil` may not read the vault; `victim` may. `evil` hands `victim` a
 * stream carrying its code in each of those places, and `victim` uses the stream so that code runs. Every read is
 * refused. With no rule against `evil`, the module's own plants read the secret, so each one really runs; code it
 * compiles at run time (`eval`, `new Function`) belongs to no module and is refused either way.
 *
 * Files are told apart only under Node's own loader (vite transforms the modules it loads), so the fixture runs in a
 * child process: `api_tests/api_test_stream_plants/__probe.mjs`.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROBE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_stream_plants/__probe.mjs");

// The module's own functions, planted directly.
const OWN_CODE = ["onwrite", "readableState", "events", "on", "writeCallback", "handle", "global"];
// Code the module compiles at run time, which belongs to no module.
const COMPILED = ["eval", "newFunction"];
const REFUSED = ["PERMISSION_DENIED", "RUNTIME_NO_ACTIVE_CONTEXT_SELF"];
const CONFIGS = ["eager/async", "eager/live", "lazy/async", "lazy/live"];

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

describe("Permissions > code planted in a Node stream's internal state, under Node's own loader (#708)", () => {
	const result = spawnSync(process.execPath, [...probeConditions(), PROBE], { encoding: "utf8", timeout: 120000 });
	const out = result.status === 0 ? JSON.parse(result.stdout) : {};

	it("runs the probe cleanly", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
		expect(Object.keys(out)).toHaveLength(CONFIGS.length * 2);
	});

	it.each(CONFIGS)("refuses every read of the module's planted code when the module may not read — %s", (config) => {
		const results = out[`${config}/evilDenied`];
		expect(Object.keys(results)).toEqual([...OWN_CODE, ...COMPILED]);
		for (const [kind, value] of Object.entries(results)) expect([kind, REFUSED.includes(value)]).toEqual([kind, true]);
	});

	it.each(CONFIGS)("lets the module's own planted code read when the module may — %s", (config) => {
		const results = out[`${config}/allAllowed`];
		for (const kind of OWN_CODE) expect([kind, results[kind]]).toEqual([kind, 42]);
		for (const kind of COMPILED) expect([kind, REFUSED.includes(results[kind])]).toEqual([kind, true]);
	});
});
