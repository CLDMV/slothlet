/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-load-package-frame.test.vitest.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:08:52-08:00 (1795536532)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A package's or a host file's code between the code a file's load started and the node it calls is
 * attributed as it is inside a call: it acts for the code that called it.
 *
 * @description
 * Fixture `api_test_load_package_frame`:
 * ```
 * api/bag/bag.mjs        give(route, depth): a function calling the vault through a package, two packages, a host
 *                        file's function, or directly
 * api/runner/runner.mjs  starts a timer's job queue, a chain of promise jobs and microtasks queued from it at its top
 *                        level; later(via, route, depth) runs a route's code there, now(route, depth) inside the call
 * api/crunner.cjs        the same for a CommonJS file, with a timer's job queue
 * api/hrunner/hrunner.mjs runs a route's code from the job queue lib/queue.mjs started when it loaded
 * api/vault/vault.mjs    get() → "SECRET"
 * ```
 * A route `"own-<route>"` is the running file's own code, written outside every export; any other route is the bag's
 * function. The packages are `callback-walker` and `frame-relay` (which calls `callback-walker`), and `cjs-walker` for
 * the CommonJS file; the host file's function is `lib/host/walk.mjs`.
 *
 * Expected values come from the rule for code a file starts while it loads (docs/PERMISSIONS.md): the file's module is
 * the caller and the code doing the access is its definer, and a package's or the host's code acts for the code that
 * called it, as inside a call. So the answers are those of the same code run inside a call (`runner.now`):
 *
 * | Rules                          | The bag's function | The file's own code |
 * | ------------------------------ | ------------------ | ------------------- |
 * | deny `bag.** → vault.**`       | `PERMISSION_DENIED`| `"SECRET"`          |
 * | deny the running file's module | `PERMISSION_DENIED`| `PERMISSION_DENIED` |
 * | nothing denied                 | `"SECRET"`         | `"SECRET"`          |
 *
 * Past 1024 frames of such code nothing says whose access it is, and it is refused whatever the rules (the 1024-frame
 * limit of the package-frame rule). Those rows run the file's own code: the bag's function that deep is told by other
 * rules (under `"precise"` it is a stand-in whose record names its definer, and under Node's own loader the package it
 * goes through is one other modules import, which answers for them).
 *
 * The in-process rows run under vitest, whose module runner loads the packages with no importer slothlet records, so
 * they read as the host's files. The child-process rows run under Node's own loader, where slothlet records which
 * modules import each package.
 * @module tests/vitests/suites/permissions/permissions-load-package-frame
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { walk } from "../../../../api_tests/api_test_load_package_frame/lib/host/walk.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const BASE = path.resolve(ROOT, "api_tests/api_test_load_package_frame/api");
const WALK = path.resolve(ROOT, "api_tests/api_test_load_package_frame/lib/host/walk.mjs");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MATRIX = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["precise", "fast"].flatMap((attribution) => [true, false].map((capture) => ({ mode, runtime, attribution, capture })))
	)
);

const RULE_SETS = [
	{ label: "the bag denied", rules: [{ caller: "bag.**", target: "vault.**", effect: "deny" }], bag: DENIED, own: SECRET },
	{
		label: "the running files' modules denied",
		rules: ["runner", "crunner", "hrunner"].map((module) => ({ caller: `${module}.**`, target: "vault.**", effect: "deny" })),
		bag: DENIED,
		own: DENIED
	},
	{ label: "nothing denied", rules: [], bag: SECRET, own: SECRET }
];

/** Depth short of the frames read first, past them, and past the 1024 read to. */
const NEAR = 5;
const DEEP = 600;
const TOO_DEEP = 1100;

/**
 * The rows: which runner, which flow, which route and how deep.
 * @type {Array<{runner: string, via: string|null, route: string, depth: number}>}
 */
const ROWS = [
	...["timer", "promise", "microtask"].flatMap((via) => [
		...["package", "two", "host", "direct", "own-package", "own-two", "own-host", "own-direct"].map((route) => ({
			runner: "runner",
			via,
			route,
			depth: NEAR
		})),
		...["package", "own-package"].map((route) => ({ runner: "runner", via, route, depth: DEEP }))
	]),
	...["own-package", "own-two", "own-host"].map((route) => ({ runner: "runner", via: "timer", route, depth: TOO_DEEP })),
	...["package", "host", "direct", "own-package", "own-host", "own-direct"].map((route) => ({
		runner: "crunner",
		via: null,
		route,
		depth: NEAR
	})),
	...["own-package", "own-host"].map((route) => ({ runner: "crunner", via: null, route, depth: TOO_DEEP })),
	...["package", "host", "direct", "own-package", "own-host", "own-direct"].map((route) => ({
		runner: "hrunner",
		via: null,
		route,
		depth: NEAR
	})),
	...["own-package", "own-host"].map((route) => ({ runner: "hrunner", via: null, route, depth: TOO_DEEP }))
];

/**
 * What a row answers under a rule set, by the rule in the description.
 * @param {{route: string, depth: number}} row - The row.
 * @param {{bag: string, own: string}} set - The rule set.
 * @returns {string} The expected answer.
 */
const expected = (row, set) => (row.depth > 1024 ? DENIED : row.route.startsWith("own-") ? set.own : set.bag);

/**
 * A row's name.
 * @param {{runner: string, via: string|null, route: string, depth: number}} row - The row.
 * @returns {string} The name.
 */
const rowName = (row) => `${row.runner}${row.via ? ` ${row.via}` : ""} ${row.route} @${row.depth}`;

/**
 * Run a row's code from the flow its runner's load started.
 * @param {object} api - The instance.
 * @param {{runner: string, via: string|null, route: string, depth: number}} row - The row.
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 */
const later = (api, row) => (row.via ? api[row.runner].later(row.via, row.route, row.depth) : api[row.runner].later(row.route, row.depth));

beforeAll(() => {
	globalThis.__loadPackageFrameWalk = walk;
});

afterAll(() => {
	delete globalThis.__loadPackageFrameWalk;
});

describe.each(MATRIX)(
	"code a file's load started, through a package > $mode / $runtime / $attribution / capture $capture",
	({ mode, runtime, attribution, capture }) => {
		describe.each(RULE_SETS)("$label", (set) => {
			let api;

			beforeAll(async () => {
				api = await slothlet({
					base: BASE,
					mode,
					runtime,
					silent: true,
					permissions: { policy: "allow", caller: { attribution, capture }, rules: set.rules }
				});
			});

			afterAll(async () => {
				await api?.shutdown?.();
				api = null;
			});

			it.each(ROWS.map((row) => ({ ...row, name: rowName(row), answer: expected(row, set) })))(
				"$name answers $answer",
				async (row) => {
					expect(await later(api, row)).toBe(row.answer);
				},
				60000
			);

			it.each(
				ROWS.filter((row) => row.runner === "runner" && row.via === "timer" && row.depth < 1024).map((row) => ({
					...row,
					name: rowName(row),
					answer: expected(row, set)
				}))
			)(
				"$name answers inside a call as it does from the load's flow: $answer",
				async (row) => {
					expect(await api.runner.now(row.route, row.depth)).toBe(row.answer);
				},
				60000
			);
		});
	}
);

/**
 * Build the fixture in a Node process of its own for every config and rule set, and run the rows there.
 * @returns {Record<string, string>} What each row gave, by config, rule set and row.
 */
function runChildRows() {
	const rows = ROWS.filter((row) => row.depth !== DEEP);
	const script = `
		import slothlet from "@cldmv/slothlet";
		import { walk } from ${JSON.stringify(WALK)};
		globalThis.__loadPackageFrameWalk = walk;
		const keep = setInterval(() => {}, 1000);
		const out = {};
		for (const { mode, runtime, attribution, capture } of ${JSON.stringify(MATRIX)})
			for (const { label, rules } of ${JSON.stringify(RULE_SETS)}) {
				const api = await slothlet({
					base: ${JSON.stringify(BASE)}, mode, runtime, silent: true,
					permissions: { policy: "allow", rules, caller: { attribution, capture } }
				});
				for (const row of ${JSON.stringify(rows)}) {
					const name = [mode, runtime, attribution, capture, label, row.runner, row.via, row.route, row.depth].join(" | ");
					out[name] = await (row.via ? api[row.runner].later(row.via, row.route, row.depth) : api[row.runner].later(row.route, row.depth));
				}
				await api.shutdown();
			}
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		clearInterval(keep);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: ROOT,
		encoding: "utf8",
		timeout: 600000,
		maxBuffer: 64 * 1024 * 1024
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe("code a file's load started, through a package, under Node's own loader", () => {
	/** @type {Record<string, string>|null} */
	let answers = null;
	const read = () => (answers ??= runChildRows());

	describe.each(MATRIX)("$mode / $runtime / $attribution / capture $capture", ({ mode, runtime, attribution, capture }) => {
		describe.each(RULE_SETS)("$label", (set) => {
			it.each(ROWS.filter((row) => row.depth !== DEEP).map((row) => ({ ...row, name: rowName(row), answer: expected(row, set) })))(
				"$name answers $answer",
				(row) => {
					const key = [mode, runtime, attribution, capture, set.label, row.runner, row.via, row.route, row.depth].join(" | ");
					expect(read()[key]).toBe(row.answer);
				},
				600000
			);
		});
	});
});
