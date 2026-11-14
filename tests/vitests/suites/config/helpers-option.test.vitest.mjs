/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/helpers-option.test.vitest.mjs
 *	@Date: 2026-11-12T00:17:44-08:00 (1794471464)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T00:17:44-08:00 (1794471464)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `helpers` option: whether a helper file (a file an api file imports that is no api file itself) is
 * loaded once per instance or once per importing api file.
 *
 * @description
 * Fixture `api_test_helper_copies`. `helpers/tally.mjs` (which imports `helpers/store.mjs`) is imported by `one.mjs`
 * and `two.mjs`; `helpers/tally.cjs` is imported by both and required by `three.cjs` and `four.cjs`. Each helper keeps
 * a count in module state, has a function of its own reading the vault, and the ES module one starts a job queue when
 * it loads.
 *
 * Expected values:
 * - State comes from plain JavaScript. `helpers: "instance"` (the default) is one module: every importer counts on
 *   the same number. `helpers: "module"` is one module per importing api file: each counts on its own, as two plain
 *   copies of the module would.
 * - Permissions come from the rules as ruled. With one copy, a helper's own code where only the stack can say
 *   (nested in returned data, or under `attribution: "fast"`), and what the helper starts when it loads, are held to
 *   every importing api file's module. With a copy per api file, an ES module copy's frames name the file it was
 *   loaded for, so its code is held to that file's module alone. A CommonJS copy's frames carry only the file's path,
 *   so the every-importer rule stays for it. Under `"precise"` a function a leaf returns runs as that leaf either way.
 *
 * @module tests/vitests/suites/config/helpers-option
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { commonJSWrapperSource, propagateInstanceQuery } from "@cldmv/slothlet/helpers/instance-imports";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_helper_copies/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MODES = [];
for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) MODES.push({ name: `${mode}/${runtime}`, mode, runtime });

/** The option's values: unset is `"instance"`. */
const OPTIONS = [
	{ label: "helpers not set", helpers: undefined, perModule: false },
	{ label: 'helpers: "instance"', helpers: "instance", perModule: false },
	{ label: 'helpers: "module"', helpers: "module", perModule: true }
];

/** The api files loading each helper. */
const ESM_IMPORTERS = ["one", "two"];
const CJS_IMPORTERS = ["one", "two", "three", "four"];

/**
 * Run a function, giving back what it returns or the code of the error it threw.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} The outcome.
 */
async function settle(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

describe.each(MODES)("Config > helpers > module state > $name", ({ mode, runtime }) => {
	describe.each(OPTIONS)("$label", ({ helpers, perModule }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: DIR, mode, runtime, silent: true, ...(helpers ? { helpers } : {}) });
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it("an ES module helper two api files import", async () => {
			const counts = [await api.one.bump(), await api.one.bump(), await api.two.bump(), await api.two.bump()];
			// One module counts 1, 2, 3, 4; two copies of it count 1, 2 each.
			expect(counts).toEqual(perModule ? [1, 2, 1, 2] : [1, 2, 3, 4]);
		});

		it("a CommonJS helper two ES module api files import and two CommonJS api files require", async () => {
			const counts = [
				await api.one.bumpCjs(),
				await api.two.bumpCjs(),
				await api.three.bumpCjs(),
				await api.four.bumpCjs(),
				await api.one.bumpCjs()
			];
			expect(counts).toEqual(perModule ? [1, 1, 1, 1, 2] : [1, 2, 3, 4, 5]);
		});
	});

	it('a second instance with helpers: "module" shares nothing with the first', async () => {
		const first = await slothlet({ base: DIR, mode, runtime, silent: true, helpers: "module" });
		const second = await slothlet({ base: DIR, mode, runtime, silent: true, helpers: "module" });
		try {
			expect([await first.one.bump(), await first.one.bump(), await second.one.bump()]).toEqual([1, 2, 1]);
			expect([await first.three.bumpCjs(), await first.three.bumpCjs(), await second.three.bumpCjs()]).toEqual([1, 2, 1]);
		} finally {
			await first.shutdown();
			await second.shutdown();
		}
	});
});

/** The rule sets: the rules, and which caller paths they deny the vault. */
const RULE_SETS = [
	{ rules: "nothing denied", list: [], denies: () => false },
	{
		rules: "the module path one denied",
		list: [{ caller: "one", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "one"
	},
	{
		rules: "the module path two denied",
		list: [{ caller: "two", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "two"
	}
];

describe.each(MODES)("Config > helpers > whose code a helper's is > $name", ({ mode, runtime }) => {
	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		describe.each(OPTIONS)("$label", ({ helpers, perModule }) => {
			describe.each(RULE_SETS)("$rules", ({ list, denies }) => {
				let api;

				beforeAll(async () => {
					api = await slothlet({
						base: DIR,
						mode,
						runtime,
						silent: true,
						...(helpers ? { helpers } : {}),
						permissions: { defaultPolicy: "allow", attribution, rules: list }
					});
					// Load every file, so a lazy tree records the same imports an eager one does.
					for (const file of CJS_IMPORTERS) await api[file].bumpCjs();
				});

				afterAll(async () => {
					await api?.shutdown();
				});

				it.each(ESM_IMPORTERS)("the ES module helper's function %s returns", async (file) => {
					const fn = await api[file].give();
					// "precise": the leaf that handed it out. "fast": the file its copy was loaded for, or every importer.
					const heldTo = attribution === "precise" ? [`${file}.give`] : perModule ? [file] : ESM_IMPORTERS;
					expect(await settle(() => fn())).toBe(heldTo.some(denies) ? DENIED : SECRET);
				});

				it.each(ESM_IMPORTERS)("the ES module helper's function %s returns inside data", async (file) => {
					const { run } = await api[file].box();
					const heldTo = perModule ? [file] : ESM_IMPORTERS;
					expect(await settle(() => run())).toBe(heldTo.some(denies) ? DENIED : SECRET);
				});

				it.each(ESM_IMPORTERS)("what the ES module helper started when it loaded, used by %s", async (file) => {
					const heldTo = perModule ? [file] : ESM_IMPORTERS;
					expect(await api[file].viaQueue()).toBe(heldTo.some(denies) ? DENIED : SECRET);
				});
			});
		});
	});
});

describe.each(MODES)("Config > helpers > a CommonJS helper's own code > $name", ({ mode, runtime }) => {
	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		describe.each(OPTIONS.filter(({ helpers }) => helpers))("$label", ({ helpers }) => {
			describe.each(RULE_SETS)("$rules", ({ list, denies }) => {
				let api;

				beforeAll(async () => {
					api = await slothlet({
						base: DIR,
						mode,
						runtime,
						helpers,
						silent: true,
						permissions: { defaultPolicy: "allow", attribution, rules: list }
					});
					for (const file of CJS_IMPORTERS) await api[file].bumpCjs();
				});

				afterAll(async () => {
					await api?.shutdown();
				});

				// A CommonJS copy's frames carry the file's path and nothing else, so nothing says which api file's copy runs:
				// it is held to every api file loading the helper, with one copy and with a copy per api file.
				it.each(ESM_IMPORTERS)("the CommonJS helper's function %s returns inside data", async (file) => {
					const { run } = await api[file].boxCjs();
					expect(await settle(() => run())).toBe(CJS_IMPORTERS.some(denies) ? DENIED : SECRET);
				});
			});
		});
	});
});

/**
 * Build one instance in a process of its own and read the vault from the queue the ES module helper started when it
 * loaded, through `one` and through `two`. A process of its own keeps every other test's imports out of the run. The
 * cause these rows were written for (slothlet's own `runtime.mjs`, which waits at its top level, being loaded while the
 * first api file loads) is gone: slothlet loads it before the first api file, so the rows no longer exercise that guard.
 * @param {string} helpers - The `helpers` option.
 * @param {Array<object>} list - The permission rules.
 * @returns {{queued: string[], mislabelled: string}} What `one.viaQueue()` and `two.viaQueue()` gave, and what running
 *   the function `two.mislabelled()` handed out gave.
 */
function runFirstInstance(helpers, list) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const keep = setInterval(() => {}, 1000);
		const api = await slothlet({ base: ${JSON.stringify(DIR)}, helpers: ${JSON.stringify(helpers)}, silent: true, permissions: { defaultPolicy: "allow", attribution: "fast", rules: ${JSON.stringify(list)} } });
		const settle = async (fn) => { try { return await fn(); } catch (error) { return error?.code ?? String(error?.message ?? error); } };
		const queued = [await api.one.viaQueue(), await api.two.viaQueue()];
		const { run } = await api.two.mislabelled();
		process.stdout.write("RESULT " + JSON.stringify({ queued, mislabelled: await settle(() => run()) }) + "\\n");
		await api.shutdown();
		clearInterval(keep);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: path.resolve(DIR, "../../.."),
		encoding: "utf8",
		timeout: 120000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe("Config > helpers > the first instance of a process", () => {
	const denyOne = [{ caller: "one", target: "vault.**", effect: "deny" }];
	const denyTwo = [{ caller: "two", target: "vault.**", effect: "deny" }];

	it.each([
		{ helpers: "instance", rules: "nothing denied", list: [], expected: [SECRET, SECRET] },
		{ helpers: "module", rules: "nothing denied", list: [], expected: [SECRET, SECRET] },
		// One copy: both importers are held to. A copy each: the copy's own api file.
		{ helpers: "instance", rules: "the module path two denied", list: denyTwo, expected: [DENIED, DENIED] },
		{ helpers: "module", rules: "the module path two denied", list: denyTwo, expected: [SECRET, DENIED] }
	])(
		'what the helper started when it loaded, helpers: "$helpers", $rules',
		({ helpers, list, expected }) => {
			expect(runFirstInstance(helpers, list).queued).toEqual(expected);
		},
		120000
	);

	// two.mjs imports helpers/private.mjs itself, under a URL that says it was loaded for one.mjs. A URL is text any
	// code can write: only the instance's own record of imports says whose a helper is, and that is two.mjs.
	it.each([
		{ helpers: "instance", rules: "nothing denied", list: [], expected: SECRET },
		{ helpers: "instance", rules: "the module path one denied", list: denyOne, expected: SECRET },
		{ helpers: "instance", rules: "the module path two denied", list: denyTwo, expected: DENIED },
		{ helpers: "module", rules: "nothing denied", list: [], expected: SECRET },
		{ helpers: "module", rules: "the module path one denied", list: denyOne, expected: SECRET },
		{ helpers: "module", rules: "the module path two denied", list: denyTwo, expected: DENIED }
	])(
		'a helper loaded under a URL naming another api file is the code of the file that loaded it, helpers: "$helpers", $rules',
		({ helpers, list, expected }) => {
			expect(runFirstInstance(helpers, list).mislabelled).toBe(expected);
		},
		120000
	);
});

describe("Config > helpers > how a copy is named", () => {
	const HELPERS = path.resolve(DIR, "../helpers");
	const leafPath = path.join(DIR, "one.mjs").replace(/\\/g, "/");
	const leafFile = pathToFileURL(path.join(DIR, "one.mjs")).href;
	const tally = pathToFileURL(path.join(HELPERS, "tally.mjs")).href;
	const store = pathToFileURL(path.join(HELPERS, "store.mjs")).href;
	const params = (url) => Object.fromEntries(new URL(url).searchParams);

	it("a helper of a leaf loaded once per instance carries the instance alone", () => {
		const child = propagateInstanceQuery("../helpers/tally.mjs", `${leafFile}?slothlet_instance=a&module=m1`, tally);
		expect(params(child)).toEqual({ slothlet_instance: "a" });
	});

	it("a helper of a leaf loaded once per api file names that file and its mount", () => {
		const child = propagateInstanceQuery(
			"../helpers/tally.mjs",
			`${leafFile}?slothlet_instance=a&module=m1&slothlet_helpers=module`,
			tally
		);
		expect(child.startsWith(`${tally}?`)).toBe(true);
		expect(params(child)).toEqual({ slothlet_instance: "a", slothlet_helpers: "module", slothlet_for: leafPath, slothlet_mount: "m1" });
		// What that helper imports is the same api file's copy.
		const grandchild = propagateInstanceQuery("./store.mjs", child, store);
		expect(params(grandchild)).toEqual(params(child));
	});

	it("a leaf with no mount names no mount, and a vite id is tagged as a URL is", () => {
		const leafID = path.join(DIR, "one.mjs");
		const child = propagateInstanceQuery(
			"../helpers/tally.mjs",
			`${leafID}?slothlet_instance=a&slothlet_helpers=module`,
			path.join(HELPERS, "tally.mjs")
		);
		expect(Object.fromEntries(new URLSearchParams(child.slice(child.indexOf("?") + 1)))).toEqual({
			slothlet_instance: "a",
			slothlet_helpers: "module",
			slothlet_for: leafPath
		});
	});

	it("a CommonJS helper's wrapper runs the file in the api file's own cache", () => {
		const file = path.join(HELPERS, "tally.cjs");
		expect(commonJSWrapperSource(file, "a", null)).toContain(`.requireCJS(${JSON.stringify(file)}, "a");`);
		expect(commonJSWrapperSource(file, "a", null, leafPath, "m1")).toContain(
			`.requireCJS(${JSON.stringify(file)}, "a", ${JSON.stringify(leafPath)}, "m1");`
		);
	});
});

describe("Config > helpers > validation", () => {
	it.each(["shared", true, 1, {}])("rejects %j", async (value) => {
		await expect(slothlet({ base: DIR, silent: true, helpers: value })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
	});

	it.each([undefined, null, "instance", "module"])("accepts %j", async (value) => {
		const api = await slothlet({ base: DIR, silent: true, helpers: value });
		expect(await api.vault.ping()).toBe("pong");
		await api.shutdown();
	});
});
