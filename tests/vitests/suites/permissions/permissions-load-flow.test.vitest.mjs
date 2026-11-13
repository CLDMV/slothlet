/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-load-flow.test.vitest.mjs
 *	@Date: 2026-11-12T22:51:00-08:00 (1794552660)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:51:00-08:00 (1794552660)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Whose load an api file's top level runs in, in the first instance of a process.
 *
 * @description
 * Fixture `api_test_load_flow`:
 * ```
 * api/first.cjs    a CommonJS api file, loaded first; asks for slothlet's runtime with an import() it does not wait for
 * api/second.mjs   imports the runtime; starts a job queue at its top level; viaQueue() reads the vault from that queue
 * api/vault.mjs    get() → "SECRET"
 * ```
 * The rule the expected values come from: what an api file starts at its top level runs as that file's module
 * (docs/PERMISSIONS.md, "Code a file starts while it loads"). The queue is `second.mjs`'s own, so its read of the vault
 * is held to the module path `second` and to no other file's: denying `first` changes nothing, denying `second`
 * refuses it.
 *
 * Slothlet's runtime waits at its top level. In the first instance of a process it used to be loaded by whichever api
 * file asked for it first, and every api file waiting on it was then evaluated in that file's load: `second.mjs`'s
 * queue carried `first`'s module. Each row builds its instance in a Node process of its own, since only the first
 * instance of a process loads the runtime.
 *
 * A file's own top-level `await` has the same effect, and slothlet cannot load a module's files ahead of the module:
 * ```
 * helpers/slow.mjs   waits at its top level
 * api/early.mjs      loaded before late.mjs; starts loading slow.mjs with an import() it does not wait for
 * helpers/queue.mjs  imports slow.mjs; starts a job queue at its top level
 * api/late.mjs       the only importer of queue.mjs; viaHelper() reads the vault from the helper's queue
 * ```
 * `queue.mjs` waits on `slow.mjs`, so it is evaluated when `slow.mjs` is ready, in the flow that started loading it:
 * `early.mjs`'s load. Its queue is still the helper's, held to the api file importing the helper (`late`), and it is
 * not refused as code no one accounts for. On the async runtime the queue carries the module of the load it was
 * evaluated in as well, so `early` has to be allowed too (docs/PERMISSIONS.md: "held to as well, beside the
 * importers"); the live runtime pins the queue to the helper's own importer.
 *
 * @module tests/vitests/suites/permissions/permissions-load-flow
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const DIR = path.resolve(ROOT, "api_tests/api_test_load_flow/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/** The rule sets: the rules, and what the queue's read of the vault gives under them. */
const RULE_SETS = [
	{ rules: "nothing denied", list: [], expected: SECRET },
	{ rules: "the module path first denied", list: [{ caller: "first", target: "vault.**", effect: "deny" }], expected: SECRET },
	{ rules: "the module path second denied", list: [{ caller: "second", target: "vault.**", effect: "deny" }], expected: DENIED }
];

/**
 * Build the fixture as the first instance of a Node process and read the vault from the queue `second.mjs` started
 * when it loaded.
 * @param {{mode: string, runtime: string, attribution: string}} config - The config.
 * @param {Array<object>} list - The permission rules.
 * @returns {string} What the read gave.
 */
function runFirstInstance(config, list) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const keep = setInterval(() => {}, 1000);
		const api = await slothlet({
			base: ${JSON.stringify(DIR)}, mode: ${JSON.stringify(config.mode)}, runtime: ${JSON.stringify(config.runtime)}, silent: true,
			permissions: { defaultPolicy: "allow", attribution: ${JSON.stringify(config.attribution)}, rules: ${JSON.stringify(list)} }
		});
		process.stdout.write("RESULT " + JSON.stringify(await api.second.viaQueue()) + "\\n");
		await api.shutdown();
		clearInterval(keep);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: ROOT,
		encoding: "utf8",
		timeout: 120000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe.each(MATRIX)("Permissions > the load an api file's top level runs in > $name", (config) => {
	it.each(RULE_SETS)(
		"the queue an api file started when it loaded is that file's module's, $rules",
		({ list, expected }) => {
			expect(runFirstInstance(config, list)).toBe(expected);
		},
		120000
	);
});

/** The rule sets for the helper's queue: the rules, and what its read of the vault gives on each runtime. */
const HELPER_RULE_SETS = [
	{ rules: "nothing denied", list: [], expected: () => SECRET },
	{
		rules: "the importing module path late denied",
		list: [{ caller: "late", target: "vault.**", effect: "deny" }],
		expected: () => DENIED
	},
	{
		rules: "the module path early denied",
		list: [{ caller: "early", target: "vault.**", effect: "deny" }],
		expected: (runtime) => (runtime === "async" ? DENIED : SECRET)
	}
];

/**
 * Build the fixture once per config and rule set, in one Node process of its own, and read the vault from the queue
 * `helpers/queue.mjs` started when it loaded. Node's own loader evaluates a file waiting on a top-level `await` in the
 * flow that started the awaited module; vitest's module runner evaluates each file in its importer's.
 * @returns {Record<string, string>} What `late.viaHelper()` gave, by config name and rule set.
 */
function runHelperRows() {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const keep = setInterval(() => {}, 1000);
		const out = {};
		for (const { name, attribution, mode, runtime } of ${JSON.stringify(MATRIX)})
			for (const { rules, list } of ${JSON.stringify(HELPER_RULE_SETS.map(({ rules, list }) => ({ rules, list })))}) {
				const api = await slothlet({
					base: ${JSON.stringify(DIR)}, mode, runtime, silent: true,
					permissions: { defaultPolicy: "allow", attribution, rules: list }
				});
				// A lazy tree loads the files in the order an eager one does.
				await api.early.ping();
				out[name + " | " + rules] = await api.late.viaHelper();
				await api.shutdown();
			}
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		clearInterval(keep);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: ROOT,
		encoding: "utf8",
		timeout: 240000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe("Permissions > a helper evaluated in another api file's load", () => {
	/** @type {Record<string, string>|null} */
	let rows = null;
	const answers = () => (rows ??= runHelperRows());

	describe.each(MATRIX)("$name", ({ name, runtime }) => {
		it.each(HELPER_RULE_SETS)(
			"the queue the helper started when it loaded is held to its importer, and to the load it was evaluated in, $rules",
			({ rules, expected }) => {
				expect(answers()[`${name} | ${rules}`]).toBe(expected(runtime));
			},
			240000
		);
	});
});
