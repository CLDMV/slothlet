/**
 * @fileoverview Whose code a helper file is does not depend on anything a module can write.
 *
 * @description
 * A helper file's code is held to the api files that import it, as slothlet's resolve hook recorded them. Fixture
 * `api_test_import_record`:
 * ```
 * api/vault.mjs       get() → "SECRET"
 * api/trusted.mjs     may read the vault; imports no helper
 * api/guest.mjs       imports helpers/reader.mjs, loads helpers/tagged.mjs under a URL it wrote itself
 * helpers/reader.mjs  read() reads the vault and keeps the answer
 * helpers/tagged.mjs  the same
 * ```
 * With `guest` denied the vault, the helper's function is refused wherever it runs: run by the host, and from a timer
 * once the call is over. That holds after `guest` has changed every collection of importers it can reach through the
 * process-wide state, after it has recorded `trusted.mjs` as an importer through the function the state offers, and
 * for a copy it loaded under a URL naming `trusted.mjs` as the file it was loaded for.
 *
 * Each config runs in a Node process of its own: the record is kept by Node's resolve hook, which a vitest worker
 * replaces with its own module runner.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const BASE = path.resolve(ROOT, "api_tests/api_test_import_record/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) =>
		["precise", "fast"].flatMap((attribution) => ["instance", "module"].map((helpers) => ({ mode, runtime, attribution, helpers })))
	)
);

/**
 * Build the fixture in a process of its own, once per case, and report what the helper's reads gave in each.
 * @param {{mode: string, runtime: string, attribution: string, helpers: string}} config - The config.
 * @returns {Record<string, {host?: string, timer?: string, tagged?: string, reached?: number}>} The answers by case.
 */
function runCases(config) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const config = ${JSON.stringify(config)};
		const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
		const build = (deny) => slothlet({
			base: ${JSON.stringify(BASE)}, mode: config.mode, runtime: config.runtime, helpers: config.helpers, silent: true,
			permissions: { defaultPolicy: "allow", attribution: config.attribution, rules: deny ? [{ caller: "guest.**", target: "vault.**", effect: "deny" }] : [] }
		});
		const runHelper = async (api) => {
			const boxed = await api.guest.box();
			await boxed.run();
			const host = await api.guest.peek();
			await api.guest.arm();
			await wait(60);
			return { host, timer: await api.guest.peek() };
		};
		const out = {};
		let api = await build(false);
		out.allowed = await runHelper(api);
		await api.slothlet.shutdown();
		api = await build(true);
		out.denied = await runHelper(api);
		await api.slothlet.shutdown();
		api = await build(true);
		const reached = await api.guest.rewrite();
		out.rewritten = { ...(await runHelper(api)), reached };
		await api.slothlet.shutdown();
		api = await build(true);
		await api.guest.claim();
		out.claimed = await runHelper(api);
		const boxed = await api.guest.boxTagged();
		await boxed.run();
		out.claimed.tagged = await api.guest.peekTagged();
		await api.slothlet.shutdown();
		console.log("RESULT " + JSON.stringify(out));
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

describe.each(matrix)("the record of imports ($mode, $runtime, $attribution, helpers: $helpers)", (config) => {
	/** @type {ReturnType<typeof runCases>|null} */
	let cases = null;
	const answers = () => (cases ??= runCases(config));

	it("runs the helper as its importing module: allowed where the module is", () => {
		expect(answers().allowed).toEqual({ host: SECRET, timer: SECRET });
	}, 120000);

	it("refuses the helper what its importing module is denied", () => {
		expect(answers().denied).toEqual({ host: DENIED, timer: DENIED });
	}, 120000);

	it("refuses it the same after the module changed every collection of importers it could reach", () => {
		const { host, timer } = answers().rewritten;
		expect({ host, timer }).toEqual({ host: DENIED, timer: DENIED });
	}, 120000);

	it("refuses it the same after the module recorded another file as an importer", () => {
		const { host, timer } = answers().claimed;
		expect({ host, timer }).toEqual({ host: DENIED, timer: DENIED });
	}, 120000);

	it("refuses a copy the module loaded under a URL naming another api file, with that file recorded as an importer", () => {
		expect(answers().claimed.tagged).toBe(DENIED);
	}, 120000);
});
