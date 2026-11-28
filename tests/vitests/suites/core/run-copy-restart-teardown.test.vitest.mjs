/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/run-copy-restart-teardown.test.vitest.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:41-08:00 (1795869101)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()` open across an instance `restart()` is torn down once its callback and its work
 * have finished, as one open across a `reload()` is: the copy it kept lives exactly as long as the run needs it. Each
 * case runs with no other instance alive, as a process with one instance has it.
 *
 * Fixture (written at run time): `calls/calls.mjs` (`ping()` answers `"pong"`) and `extra/extra.mjs`, a module the run
 * adds.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-copy-restart-teardown");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(path.join(BASE, "calls", "calls.mjs"), 'export function ping() {\n\treturn "pong";\n}\n');
	writeFileSync(path.join(EXTRA, "extra.mjs"), 'export function hello() {\n\treturn "hello";\n}\n');
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * The instances a test made: shut down after it, also when it failed before its own `shutdown()`.
 * @type {Set<object>}
 */
const made = new Set();

afterEach(async () => {
	for (const api of made) await api.slothlet.shutdown().catch(() => {});
	made.clear();
});

/**
 * A promise with its resolve function.
 * @returns {{promise: Promise<*>, release: Function}} The gate.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

/**
 * Let a few macrotasks pass: teardown runs on one once the work that finished a run has.
 * @returns {Promise<void>}
 */
async function idle() {
	for (let index = 0; index < 16; index++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * What the counts look like with no run live and no copy held.
 * @type {{runs: number, held: number, readThrough: number}}
 */
const BASELINE = { runs: 0, held: 0, readThrough: 0 };

describe.each([["async"], ["live"]])(
	"a run open across an instance reload() or restart() is torn down once it finishes — %s runtime",
	(runtime) => {
		describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
			describe.each([["reload"], ["restart"]])("across %s()", (operation) => {
				it.each([["nothing"], ["an add before"], ["an add after"], ["a hook before"]])("the run changes %s", async (change) => {
					expect(runCopyCounts()).toEqual(BASELINE);
					const api = await slothlet({ base: BASE, runtime, mode, silent: true, hook: { enabled: true } });
					made.add(api);
					const entered = gate();
					const resume = gate();
					const run = api.slothlet.context.run({ user: "u" }, async () => {
						await api.calls.ping();
						if (change === "an add before") await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						if (change === "a hook before") api.slothlet.hook.on("calls.ping:after", ({ result }) => result);
						entered.release();
						await resume.promise;
						if (change === "an add after") await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						return await api.calls.ping();
					});
					await entered.promise;
					await api.slothlet[operation]();
					resume.release();
					expect(await run).toBe("pong");
					await idle();
					expect(runCopyCounts()).toEqual(BASELINE);
					await api.slothlet.shutdown();
					expect(runCopyCounts()).toEqual(BASELINE);
				});
			});
		});
	}
);
