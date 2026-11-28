/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/helpers/instance-imports-module-require.test.vitest.mjs
 *	@Date: 2026-11-12T23:04:26-08:00 (1794553466)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:49-08:00 (1795869109)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS helper an api file loads with `createRequire(import.meta.url)` is the instance's own copy,
 * in every instance built over the folder (#755).
 *
 * @description
 * Fixture `api_test_require_helper`:
 * ```
 * api/alpha.mjs, api/beta.mjs        createRequire(import.meta.url)("../lib/survey.cjs")
 * api/store.mjs                      sealed = { x, hid, obj: { k } }
 * lib/survey.cjs                     bump() counts in module state; survey(node) reads node.hid, node.obj.k and
 *                                    Object.getOwnPropertyDescriptor(node, "obj").value.k
 * ```
 * Fixture `api_test_require_helper_inside` holds the same files with `survey.cjs` inside the api folder, a leaf file
 * of its own: module code may not require a leaf file, so that tree does not load (MODULE_LEAF_IMPORT_REFUSED).
 * Expected values:
 * - What the helper reads comes from the rules: `beta.**` is denied `store.sealed.hid` and nothing else, so through
 *   `alpha` every read answers and through `beta` only `hid` is refused, in every instance, before and after an
 *   earlier instance over the same folder has shut down.
 * - The counts come from plain JavaScript and the helper rule (docs: a helper file is one copy per instance): two api
 *   files of one instance count on one module, another instance on its own, and the host's own `require` of the file
 *   on a third.
 *
 * Each config runs in a Node process of its own: the require is Node's own, which a vitest worker's module runner
 * does not go through for the files it evaluates.
 *
 * @module tests/vitests/suites/helpers/instance-imports-module-require
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIXTURE = path.resolve(ROOT, "api_tests/api_test_require_helper");
const DENIED = "PERMISSION_DENIED";

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/** What the helper's reads give through each api file, under the rules. */
const READS = {
	alpha: { hid: "S3CRET", k: 1, kDesc: 1 },
	beta: { hid: DENIED, k: 1, kDesc: 1 }
};

/**
 * Build instances over the fixture in a process of its own and report what the helper gave in each.
 * @param {{mode: string, runtime: string, attribution: string}} config - The config.
 * @returns {object} The answers by step.
 */
function runSteps(config) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		import { createRequire } from "node:module";
		const base = ${JSON.stringify(path.join(FIXTURE, "api"))};
		const build = () => slothlet({
			base, mode: ${JSON.stringify(config.mode)}, runtime: ${JSON.stringify(config.runtime)}, silent: true,
			permissions: { policy: "allow", rules: [{ caller: "beta.**", target: "store.sealed.hid", effect: "deny" }], caller: { attribution: ${JSON.stringify(config.attribution)} } }
		});
		const use = async (api) => {
			const out = {};
			for (const file of ["alpha", "beta"]) {
				await api[file].keep("sealed");
				out[file] = await api[file].look("sealed");
			}
			return out;
		};
		const out = {};
		const first = await build();
		out.first = await use(first);
		const second = await build();
		out.secondWithFirstAlive = await use(second);
		out.firstAgain = await use(first);
		out.counts = [await first.alpha.bump(), await first.beta.bump(), await second.alpha.bump(), await first.alpha.bump()];
		await first.shutdown();
		out.secondAfterFirstShutDown = await use(second);
		await second.shutdown();
		const third = await build();
		out.thirdAfterBothShutDown = await use(third);
		out.thirdCount = await third.beta.bump();
		out.hostCount = createRequire(import.meta.url)(${JSON.stringify(path.join(FIXTURE, "lib", "survey.cjs"))}).bump();
		await third.shutdown();
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
	`;
	return runScript(script);
}

/**
 * Build an instance over the tree whose api file requires a leaf file, in a process of its own, and report the codes
 * in what it threw.
 * @param {{mode: string, runtime: string, attribution: string}} config - The config.
 * @returns {{codes: string[]}} The error's code and its causes' codes.
 */
function runInside(config) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const out = { codes: [] };
		try {
			const api = await slothlet({
				base: ${JSON.stringify(path.resolve(ROOT, "api_tests/api_test_require_helper_inside/api"))},
				mode: ${JSON.stringify(config.mode)}, runtime: ${JSON.stringify(config.runtime)}, silent: true,
				permissions: { policy: "allow", caller: { attribution: ${JSON.stringify(config.attribution)} } }
			});
			await api.alpha.bump();
			await api.shutdown();
		} catch (error) {
			for (let at = error; at && out.codes.length < 10; at = at.cause) out.codes.push(at.code);
		}
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
	`;
	return runScript(script);
}

/**
 * Run a script in a Node process of its own and parse the result line it writes.
 * @param {string} script - The ES module source.
 * @returns {object} The result.
 */
function runScript(script) {
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

describe.each(MATRIX)("Helpers > a CommonJS helper loaded with createRequire > $name", (config) => {
	it("refuses an api file's require of a file inside the api folder", () => {
		expect(runInside(config).codes).toContain("MODULE_LEAF_IMPORT_REFUSED");
	}, 120000);

	describe("the helper outside the api folder", () => {
		/** @type {ReturnType<typeof runSteps>|null} */
		let steps = null;
		const answers = () => (steps ??= runSteps(config));

		it("answers in the first instance", () => {
			expect(answers().first).toEqual(READS);
		}, 120000);

		it("answers in a second instance while the first is alive, and still in the first", () => {
			expect(answers().secondWithFirstAlive).toEqual(READS);
			expect(answers().firstAgain).toEqual(READS);
		}, 120000);

		it("answers in the second instance after the first has shut down", () => {
			expect(answers().secondAfterFirstShutDown).toEqual(READS);
		}, 120000);

		it("answers in an instance built after every earlier one has shut down", () => {
			expect(answers().thirdAfterBothShutDown).toEqual(READS);
		}, 120000);

		it("is one copy per instance, and another for the host", () => {
			// first.alpha, first.beta, second.alpha, first.alpha: one module per instance.
			expect(answers().counts).toEqual([1, 2, 1, 3]);
			expect(answers().thirdCount).toBe(1);
			expect(answers().hostCount).toBe(1);
		}, 120000);
	});
});
