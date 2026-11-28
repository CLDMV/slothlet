/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-callable-folder-positions.test.vitest.mjs
 *	@Date: 2026-11-14T14:30:00-08:00 (1794695400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:20-08:00 (1795869140)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A callable folder's code is answered by the rules of the export it was written in, and a module's
 * first call of the folder (while it is still unloaded in lazy mode) answers as the same call does in eager mode. The
 * reads after it answer as they would have without it.
 *
 * @description
 * Fixture `api_test_callable_folder_positions`. Four folders hold one file each, whose default export is the folder's
 * function and whose `hidden` export is written with the same text: `selfnamed/selfnamed.mjs` (the file named after
 * its folder), `single/run.mjs` (a folder's only file of another name), and `generic/index.mjs` and `entry/main.mjs`
 * (a folder's only file of a generic name). `plain.mjs` exports `shown` and `hidden`,
 * also with the same text. Each function hands out a function that reads the vault. The rules deny the vault to
 * `<name>.hidden` and to `plain` (the file's module path), so the folder's own function and `plain.shown` are
 * allowed and everything else is refused. `runner` is a module the rules allow the vault: it calls a node and runs
 * the function it got back.
 *
 * Every configuration reads `selfnamed`, `single`, `generic` and `entry`, then `plain`, each first through `runner` (so in lazy mode the
 * module's call is what loads the folder) and then by the host. Expected values come from the rules, as eager mode
 * answers them: the folder's function and `plain.shown` read the vault, the `hidden` ones are refused, whoever runs
 * them.
 *
 * The reads run in a plain Node process, once as it is and once with an async hook enabled (`createHook()` with
 * `before` and `after`): with async hooks on, Node runs
 * its timer and immediate queues through one more frame of its own, and a call picked up after an `await` there has
 * to read as the same call.
 * @module tests/vitests/suites/permissions/permissions-callable-folder-positions
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../..");
const FIXTURE = path.join(REPO_ROOT, "api_tests/api_test_callable_folder_positions");

// The order the nodes are read in: the plain file comes after every callable folder.
const NODES = ["selfnamed", "single", "generic", "entry", "plain"];
const EXPECTED = { moduleShown: "SECRET", moduleHidden: "PERMISSION_DENIED", hostShown: "SECRET", hostHidden: "PERMISSION_DENIED" };

const CONFIGS = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * The script the child runs: for every configuration, every node's four reads, in order.
 * @param {boolean} asyncHook - Whether the child enables an async hook before it starts.
 * @returns {string} The script.
 */
function childScript(asyncHook) {
	return `
		import { createHook } from "node:async_hooks";
		import slothlet from "@cldmv/slothlet";
		if (${JSON.stringify(asyncHook)}) createHook({ before() {}, after() {} }).enable();
		const FIXTURE = ${JSON.stringify(FIXTURE)};
		const NODES = ${JSON.stringify(NODES)};
		const CONFIGS = ${JSON.stringify(CONFIGS)};
		const attempt = async (run) => { try { return await run(); } catch (error) { return error.code ?? String(error.message).slice(0, 80); } };
		const rules = [
			...NODES.map((name) => ({ caller: name + ".hidden", target: "vault.**", effect: "deny" })),
			{ caller: "plain", target: "vault.**", effect: "deny" }
		];
		const out = {};
		for (const config of CONFIGS) {
			const name = config.mode + "/" + config.runtime + "/" + config.attribution;
			const api = await slothlet({
				base: FIXTURE, mode: config.mode, runtime: config.runtime, silent: true,
				permissions: { policy: "allow", rules, caller: { attribution: config.attribution } }
			});
			out[name] = {};
			for (const node of NODES) {
				const shown = node === "plain" ? "shown" : undefined;
				out[name][node] = {
					moduleShown: await api.runner.run(node, shown),
					moduleHidden: await api.runner.run(node, "hidden"),
					hostShown: await attempt(async () => (await (shown ? api[node].shown() : api[node]()))()),
					hostHidden: await attempt(async () => (await api[node].hidden())())
				};
			}
			await api.slothlet.shutdown();
		}
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		process.exit(0);
	`;
}

describe.each([
	{ label: "no async hook", asyncHook: false },
	{ label: "an async hook enabled", asyncHook: true }
])("a callable folder's code answers as the export it was written in > $label", ({ asyncHook }) => {
	let result;

	beforeAll(async () => {
		const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", childScript(asyncHook)], {
			cwd: REPO_ROOT,
			encoding: "utf8",
			timeout: 240000
		});
		const line = String(child.stdout)
			.split("\n")
			.find((text) => text.startsWith("RESULT "));
		if (!line) throw new Error(`no result: ${child.stderr}`);
		result = JSON.parse(line.slice("RESULT ".length));
	}, 300000);

	describe.each(CONFIGS)("$mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
		const name = `${mode}/${runtime}/${attribution}`;

		it.each(NODES)("%s: the module's and the host's reads answer as the export the function was written in", (node) => {
			expect(result[name][node]).toEqual(EXPECTED);
		});
	});
});

// Indexing a callable folder's file must not change how the folder is built: the api a lazy instance builds is the one
// eager mode builds, and a lazy callable folder's first call is the same call it was.
describe("indexing a lazy callable folder's file leaves the folder as it was built", () => {
	const INSPECT = path.join(REPO_ROOT, "tools/dev/inspect-api-structure.mjs");
	// A root `calc.mjs` and a folder `calc/calc.mjs`, each `export { calc }; export default calc;`: the file's named
	// export is the same function as its default.
	const SHAPE = "smart_flatten/api_smart_flatten_fn_fn_folder";

	/**
	 * The callable paths the inspector lists for the fixture in one mode.
	 * @param {"eager"|"lazy"} mode - The mode.
	 * @param {string} runtime - The runtime.
	 * @param {boolean} hooks - Whether hooks are on.
	 * @returns {string[]} The paths, sorted.
	 */
	const callables = (mode, runtime, hooks) => {
		const args = [INSPECT, SHAPE, `--${mode}`, "--runtime", runtime, ...(hooks ? ["--hooks"] : [])];
		const child = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: "utf8", timeout: 120000 });
		if (child.status !== 0) throw new Error(`inspector failed: ${child.stderr}`);
		return [...new Set(String(child.stdout).match(/api\.[\w.$]+\(\)/g) ?? [])].sort();
	};

	it.each([
		["async", false],
		["async", true],
		["live", false],
		["live", true]
	])(
		"%s runtime, hooks %s: a lazy instance lists the callable paths an eager one lists",
		(runtime, hooks) => {
			const eager = callables("eager", runtime, hooks);
			expect(eager.length).toBeGreaterThan(0);
			expect(callables("lazy", runtime, hooks)).toEqual(eager);
		},
		300000
	);

	let api = null;
	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	it("guards the cold first call of a lazy async callable folder behind an async before hook, then hands back a plain Promise", async () => {
		const { resolveWrapper } = await import("#handlers/unified-wrapper");
		api = await slothlet({ mode: "lazy", base: path.join(REPO_ROOT, "api_tests/api_test_async_callable"), hook: { enabled: true } });
		expect(resolveWrapper(api.funcasync).____slothletInternal.state.materialized).toBe(false);
		api.slothlet.hook.on("funcasync:before", async () => {}, { id: "cold-async-folder" });

		const first = api.funcasync("x");
		expect(() => `${first}`).toThrow(/HOOK_PROMOTED_RESULT_NOT_AWAITED/);
		expect(await first).toBe("Hello, x!");

		const second = api.funcasync("y");
		expect(`${second}`).toBe("[object Promise]");
		expect(await second).toBe("Hello, y!");
	});
});
