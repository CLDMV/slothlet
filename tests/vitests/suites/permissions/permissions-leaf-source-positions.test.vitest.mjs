/**
 * @fileoverview Which leaf of a file a piece of code belongs to is read from where each export is declared in the
 * source the engine was given when the file loaded, so it holds for exports with the same text, exports renamed by a
 * list, a default export, CommonJS exports, a TypeScript leaf, a minified file, with `--enable-source-maps` on or off,
 * and for a file changed on disk after it loaded.
 *
 * @description
 * Fixture `api_test_leaf_positions`. Every file exports two functions written with the same text, each handing out
 * a function that reads the vault. The rules deny one of them (`<file>.hidden`) and the file's module path the vault
 * and allow the other. Code attributed to the right export answers as that export; code that could not be told apart
 * would run as the file's module and be refused.
 *
 * | File          | How its two exports are declared                                   |
 * | ------------- | ------------------------------------------------------------------ |
 * | `dup.mjs`     | `export const shown = …; export const hidden = …` (same text)      |
 * | `renamed.mjs` | `const inner = …, other = …; export { inner as shown, other as hidden }` |
 * | `kit/def.mjs` | `export default …` and `export const hidden = …`                   |
 * | `mini.mjs`    | minified: `const t=…,n=…;export{t as shown,n as hidden}`           |
 * | `cjsdup.cjs`  | `exports.shown = …; exports.hidden = …`                            |
 * | `cjsobj.cjs`  | `module.exports = { shown: first, hidden: second }`                |
 * | `tsdup.ts`    | TypeScript, compiled with an inline source map                     |
 *
 * Each is read four ways: the host runs the function `shown` handed out, the host runs `hidden`'s, and a module that
 * may read the vault runs each. Expected values come from the rules: `shown`'s function reads the vault, `hidden`'s is
 * refused, whoever runs it.
 *
 * The checks run in a plain Node process, once with `--enable-source-maps` and once without: a CommonJS file's own
 * `import()` of slothlet's runtime is Node's copy under vitest, and the flag is a process option.
 * @module tests/vitests/suites/permissions/permissions-leaf-source-positions
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../..");
const FIXTURE = path.join(REPO_ROOT, "api_tests/api_test_leaf_positions");

const FILES = ["dup", "renamed", "kit.def", "mini", "cjsdup", "cjsobj", "tsdup"];
const EXPECTED = { hostShown: "SECRET", hostHidden: "PERMISSION_DENIED", moduleShown: "SECRET", moduleHidden: "PERMISSION_DENIED" };

const CONFIGS = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * The script the child runs: for every configuration, every file's four reads, and the same for a copy of `dup.mjs`
 * that is changed on disk after the instance loaded it.
 * @param {string} copyDir - A scratch folder to copy the fixture into for the changed-on-disk case.
 * @returns {string} The script.
 */
function childScript(copyDir) {
	return `
		import fs from "node:fs";
		import path from "node:path";
		import slothlet from "@cldmv/slothlet";
		const FIXTURE = ${JSON.stringify(FIXTURE)};
		const COPY = ${JSON.stringify(copyDir)};
		const FILES = ${JSON.stringify(FILES)};
		const CONFIGS = ${JSON.stringify(CONFIGS)};
		const at = (root, dotted) => dotted.split(".").reduce((node, key) => node[key], root);
		const attempt = async (run) => { try { return await run(); } catch (error) { return error.code ?? String(error.message).slice(0, 80); } };
		const rulesFor = (files) => files.flatMap((file) => [
			{ caller: file + ".hidden", target: "vault.**", effect: "deny" },
			// A default export is its file's module node, so the module path is the export the rules allow.
			...(file === "kit.def" ? [] : [{ caller: file, target: "vault.**", effect: "deny" }])
		]);
		const read = async (api, file) => {
			const node = at(api, file);
			const shown = file === "kit.def" ? () => node() : () => node.shown();
			return {
				hostShown: await attempt(async () => (await shown())()),
				hostHidden: await attempt(async () => (await node.hidden())()),
				moduleShown: await api.runner.run(file, file === "kit.def" ? undefined : "shown"),
				moduleHidden: await api.runner.run(file, "hidden")
			};
		};
		const out = { files: {}, edited: {} };
		for (const config of CONFIGS) {
			const name = config.mode + "/" + config.runtime + "/" + config.attribution;
			const api = await slothlet({
				base: FIXTURE, mode: config.mode, runtime: config.runtime, silent: true,
				typescript: { mode: "fast", sourcemap: true },
				permissions: { defaultPolicy: "allow", attribution: config.attribution, rules: rulesFor(FILES) }
			});
			out.files[name] = {};
			for (const file of FILES) out.files[name][file] = await read(api, file);
			await api.slothlet.shutdown();

			// A copy of dup.mjs loaded, then changed on disk: thirty lines put before its code, the two exports swapped.
			const dir = path.join(COPY, name.replaceAll("/", "-"));
			fs.mkdirSync(dir, { recursive: true });
			for (const file of ["dup.mjs", "vault.mjs", "runner.mjs"]) fs.copyFileSync(path.join(FIXTURE, file), path.join(dir, file));
			const copy = await slothlet({
				base: dir, mode: config.mode, runtime: config.runtime, silent: true,
				permissions: { defaultPolicy: "allow", attribution: config.attribution, rules: rulesFor(["dup"]) }
			});
			await copy.dup;
			const original = fs.readFileSync(path.join(dir, "dup.mjs"), "utf8");
			fs.writeFileSync(path.join(dir, "dup.mjs"), "// changed after load\\n".repeat(30) + original.replace("const shown", "const swapped").replace("const hidden", "const shown").replace("const swapped", "const hidden"));
			out.edited[name] = await read(copy, "dup");
			await copy.slothlet.shutdown();
		}
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		process.exit(0);
	`;
}

describe.each([
	{ label: "without --enable-source-maps", flags: [] },
	{ label: "with --enable-source-maps", flags: ["--enable-source-maps"] }
])("a leaf's code is told from where its export is declared > $label", ({ flags }) => {
	let result;
	let copyDir;

	beforeAll(async () => {
		copyDir = await makeTestTmpDir("leaf-positions");
		const child = spawnSync(process.execPath, [...flags, "--conditions=slothlet-dev", "--input-type=module", "-e", childScript(copyDir)], {
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

	afterAll(() => {
		fs.rmSync(copyDir, { recursive: true, force: true });
	});

	describe.each(CONFIGS)("$mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
		const name = `${mode}/${runtime}/${attribution}`;

		it.each(FILES)("%s: each export's function answers as that export", (file) => {
			expect(result.files[name][file]).toEqual(EXPECTED);
		});

		it("a file changed on disk after it loaded is still read as it was loaded", () => {
			expect(result.edited[name]).toEqual(EXPECTED);
		});
	});
});
