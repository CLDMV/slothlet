/**
 * @fileoverview One file is one module inside an instance when a CommonJS leaf requires it by a bare specifier too (#715).
 * @description
 * The fixture's apis sit in a package of their own (`pkg/package.json`, named, with an `imports` field and an `exports`
 * map). Each api's `.cjs` leaf requires the package's ES module helper and its CommonJS helper by `#imports`, by the
 * package's own name and by a relative path; the `imports` api puts `#imports` first and the `self` api the package's
 * name, since Node caches a required file by its path and the first spelling decides which copy the later ones reach.
 * Every spelling resolves into the leaf's own package, so each gets the instance's copy, as a relative require does
 * (docs/MODULE-STRUCTURE.md, "Helper Modules Are Per Instance"): one copy of each helper per instance, the same exported
 * object through every spelling inside an instance, and a separate copy for each instance. Under Node's own loader the
 * ES module the `.cjs` leaf requires is also the module the instance's ES module leaf imports by `#h`; under vitest an ES
 * module leaf loads through vite's module graph while a `.cjs` leaf's requires load natively (see
 * `helper-imports-mixed-formats`), so only the CommonJS helper is one copy across the two leaves there. The same host
 * runs under Node's own loader and under vitest with slothlet inlined and the `slothletInstanceImports()` plugin, two
 * instances in each of eager/lazy × async/live for each api.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIXTURE = path.join(ROOT, "api_tests", "api_test_own_package_requires");
const CONFIG = path.join(FIXTURE, "vitest", "vitest.config.mjs");
const VITEST = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
const CASES = ["imports", "self"].flatMap((api) =>
	["eager/async", "eager/live", "lazy/async", "lazy/live"].flatMap((config) => [`${api}/${config}/1`, `${api}/${config}/2`])
);

/**
 * The export conditions this worker runs under, so the children load the same build of slothlet.
 * @returns {string[]} The conditions, as `--conditions=x` arguments.
 */
function conditions() {
	const found = [];
	process.execArgv.forEach((arg, index, all) => {
		if (arg.startsWith("--conditions=")) found.push(arg);
		else if ((arg === "--conditions" || arg === "-C") && all[index + 1]) found.push(`--conditions=${all[index + 1]}`);
	});
	return found.length ? found : ["--conditions=slothlet-dev"];
}

/**
 * The environment for a child: this worker's, without the variables that tell a process it is already a vitest worker.
 * @returns {Record<string, string>} The environment.
 */
function childEnv() {
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (key.startsWith("VITEST") || key === "TINYPOOL_WORKER_ID") delete env[key];
	return env;
}

/**
 * Run a child and read the JSON line it prints after a prefix.
 * @param {string[]} args - The child's arguments after the conditions.
 * @param {string} prefix - The prefix of the line, or "" for a line that is JSON itself.
 * @returns {{result: object, out: Record<string, any>|null}} The child's result and what it printed.
 */
function run(args, prefix) {
	const result = spawnSync(process.execPath, [...conditions(), ...args], { cwd: ROOT, env: childEnv(), encoding: "utf8", timeout: 300000 });
	// With colour forced (FORCE_COLOR; CI runs coloured), the reporter writes escape codes before the printed line.
	const line = stripVTControlCharacters(String(result.stdout))
		.split("\n")
		.find((text) => (prefix ? text.startsWith(prefix) : text.startsWith("{")));
	return { result, out: line ? JSON.parse(line.slice(prefix.length)) : null };
}

const NODE = "Node's own loader";
const RUNS = {
	[NODE]: run([path.join(FIXTURE, "probe.mjs")], ""),
	"vitest with slothletInstanceImports()": run([VITEST, "run", "--config", CONFIG], "OWN-PACKAGE-REQUIRES ")
};

describe.each(Object.keys(RUNS))(
	"Isolation > one file, one URL for a CommonJS leaf's requires within its own package (#715) > %s",
	(name) => {
		const { result, out } = RUNS[name];

		it("runs cleanly", () => {
			expect(result.status, result.stderr).toBe(0);
			expect(out).not.toBeNull();
			expect(Object.keys(out)).toEqual([...CASES, "h", "c"]);
		});

		it.each(CASES)("reaches one copy of the ES module helper by #imports, by the package's own name and by path — %s", (key) => {
			const { hByImports, hBySelf, hByPath } = out[key].req;
			expect(hByPath).toBeGreaterThanOrEqual(0);
			expect({ hByImports, hBySelf }).toEqual({ hByImports: hByPath, hBySelf: hByPath });
		});

		it.each(CASES)("reaches one copy of the CommonJS helper by #imports, by the package's own name and by path — %s", (key) => {
			const { cByImports, cBySelf, cByPath } = out[key].req;
			expect(cByPath).toBeGreaterThanOrEqual(0);
			expect({ cByImports, cBySelf }).toEqual({ cByImports: cByPath, cBySelf: cByPath });
		});

		it.each(CASES)("shares the CommonJS helper with the instance's ES module leaf — %s", (key) => {
			expect(out[key].esm.c).toBe(out[key].req.cByPath);
		});

		it.runIf(name === NODE).each(CASES)("shares the ES module helper with the instance's ES module leaf — %s", (key) => {
			expect(out[key].esm.h).toBe(out[key].req.hByPath);
		});

		it("gives each instance a copy of its own of each helper", () => {
			expect(new Set(CASES.map((key) => out[key].req.hByPath)).size).toBe(CASES.length);
			expect(new Set(CASES.map((key) => out[key].req.cByPath)).size).toBe(CASES.length);
		});

		it("evaluates the CommonJS helper once per instance", () => {
			expect(out.c.files).toEqual(CASES.map(() => "pkg/lib/c.cjs"));
		});

		it.runIf(name === NODE)("evaluates the ES module helper once per instance, each copy under an instance's tag", () => {
			expect(out.h.files).toEqual(CASES.map(() => "pkg/lib/h.mjs"));
			expect(out.h.tagged).toEqual(CASES.map(() => true));
		});
	}
);
