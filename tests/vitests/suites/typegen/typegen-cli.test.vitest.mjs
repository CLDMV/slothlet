/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typegen/typegen-cli.test.vitest.mjs
 *	@Date: 2026-05-12 19:54:32 -07:00 (1778640872)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 19:58:07 -07:00 (1778641087)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for the `slothlet` CLI binary, exercising:
 *   - subcommand-less help (and unknown subcommand error)
 *   - `typegen --help`
 *   - positional args
 *   - flag args (long and short forms)
 *   - mixed: flags override positional, positional fills in flags
 *   - package.json `slothlet.typegen` fallback when no args supplied
 *   - validation errors: missing required option, flag without value, unknown flag
 *
 * The CLI is spawned as a child Node process so we exercise the actual binary
 * end-to-end. The slothlet-dev resolver condition is preserved so the spawned
 * Node sees the same `@cldmv/slothlet/typegen` mapping the test runner uses.
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const CLI_PATH = path.join(REPO_ROOT, "bin", "slothlet.mjs");
// Use the in-repo fixture as the API source so the on-disk transform cache
// (project-local `.slothlet-cache/`) lands inside slothlet's own repo, where
// Node can self-reference `@cldmv/slothlet/runtime`. Real consumer projects
// have slothlet installed in their own node_modules so the bare-specifier
// walk works there; temp-dir tests don't, hence the in-repo fixture.
const API_FIXTURE = path.join(REPO_ROOT, "api_tests", "api_test_typescript_runtime");

const tempRoots = [];

/**
 * Make a writable temp directory for output files (and an optional package.json).
 * Source code stays in the slothlet repo — see comment on API_FIXTURE.
 */
async function freshTempDir() {
	const root = await mkdtemp(path.join(tmpdir(), "slothlet-cli-"));
	tempRoots.push(root);
	return root;
}

/**
 * Spawn the CLI and capture stdout/stderr/exit code.
 * @param {string[]} args
 * @param {{ cwd?: string }} [opts]
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runCli(args, opts = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["--conditions=slothlet-dev", CLI_PATH, ...args], {
			cwd: opts.cwd ?? REPO_ROOT,
			env: { ...process.env, NODE_OPTIONS: "--conditions=slothlet-dev" }
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
		child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
		child.on("error", reject);
		child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
	});
}

describe("slothlet CLI", () => {
	afterAll(async () => {
		await Promise.allSettled(tempRoots.map((r) => rm(r, { recursive: true, force: true })));
	});

	describe("dispatch", () => {
		it("prints help when invoked with no arguments and exits non-zero", async () => {
			const { code, stdout } = await runCli([]);
			expect(code).toBe(1);
			expect(stdout).toMatch(/Usage: slothlet/);
			expect(stdout).toMatch(/typegen/);
		});

		it("prints help and exits 0 for `--help`", async () => {
			const { code, stdout } = await runCli(["--help"]);
			expect(code).toBe(0);
			expect(stdout).toMatch(/Usage: slothlet/);
		});

		it("prints help and exits 0 for `-h`", async () => {
			const { code, stdout } = await runCli(["-h"]);
			expect(code).toBe(0);
			expect(stdout).toMatch(/Usage: slothlet/);
		});

		it("errors and exits non-zero for an unknown subcommand", async () => {
			const { code, stderr } = await runCli(["bogus"]);
			expect(code).not.toBe(0);
			expect(stderr).toMatch(/unknown command/i);
		});
	});

	describe("typegen --help", () => {
		it("prints typegen-specific help with examples", async () => {
			const { code, stdout } = await runCli(["typegen", "--help"]);
			expect(code).toBe(0);
			expect(stdout).toMatch(/Usage: slothlet typegen/);
			expect(stdout).toMatch(/--dir/);
			expect(stdout).toMatch(/--output/);
			expect(stdout).toMatch(/--interface-name/);
			expect(stdout).toMatch(/Examples:/);
		});
	});

	describe("typegen with positional args", () => {
		it("generates a .d.ts file when given dir / output / interfaceName positionally", async () => {
			const tmp = await freshTempDir();
			const out = path.join(tmp, "api.d.ts");
			const { code, stdout, stderr } = await runCli(["typegen", API_FIXTURE, out, "PositionalApi"]);
			expect(stderr).toBe("");
			expect(code).toBe(0);
			expect(stdout).toMatch(new RegExp(`Wrote ${escapeRegex(out)}`));
			expect(existsSync(out)).toBe(true);
			const content = await readFile(out, "utf8");
			expect(content).toContain("interface PositionalApi");
			expect(content).toContain("declare const self");
		});
	});

	describe("typegen with long flags", () => {
		it("generates a .d.ts file when given --dir / --output / --interface-name", async () => {
			const tmp = await freshTempDir();
			const out = path.join(tmp, "api.d.ts");
			const { code } = await runCli(["typegen", "--dir", API_FIXTURE, "--output", out, "--interface-name", "FlagApi"]);
			expect(code).toBe(0);
			expect(existsSync(out)).toBe(true);
			const content = await readFile(out, "utf8");
			expect(content).toContain("interface FlagApi");
		});
	});

	describe("typegen with short flags", () => {
		it("generates a .d.ts file when given -d / -o / -n", async () => {
			const tmp = await freshTempDir();
			const out = path.join(tmp, "api.d.ts");
			const { code } = await runCli(["typegen", "-d", API_FIXTURE, "-o", out, "-n", "ShortApi"]);
			expect(code).toBe(0);
			const content = await readFile(out, "utf8");
			expect(content).toContain("interface ShortApi");
		});
	});

	describe("typegen flag/positional precedence", () => {
		it("prefers flag values over positional values", async () => {
			const tmp = await freshTempDir();
			const flagOut = path.join(tmp, "via-flag.d.ts");
			const posOut = path.join(tmp, "via-positional.d.ts");
			const { code } = await runCli([
				"typegen",
				API_FIXTURE,
				posOut,
				"PositionalName",
				"--output",
				flagOut,
				"--interface-name",
				"FlagName"
			]);
			expect(code).toBe(0);
			expect(existsSync(flagOut)).toBe(true);
			expect(existsSync(posOut)).toBe(false);
			const content = await readFile(flagOut, "utf8");
			expect(content).toContain("interface FlagName");
		});
	});

	describe("typegen package.json fallback", () => {
		it("reads dir/output/interfaceName from package.json's slothlet.typegen when no args supplied", async () => {
			const tmp = await freshTempDir();
			const out = path.join(tmp, "from-pkg.d.ts");
			await writeFile(
				path.join(tmp, "package.json"),
				JSON.stringify({
					name: "tmp-cli-fixture",
					slothlet: { typegen: { dir: API_FIXTURE, output: out, interfaceName: "PkgApi" } }
				}),
				"utf8"
			);
			const { code, stdout } = await runCli(["typegen"], { cwd: tmp });
			expect(code).toBe(0);
			expect(stdout).toMatch(/Wrote/);
			const content = await readFile(out, "utf8");
			expect(content).toContain("interface PkgApi");
		});

		it("flag values override package.json values", async () => {
			const tmp = await freshTempDir();
			const pkgOut = path.join(tmp, "from-pkg.d.ts");
			const flagOut = path.join(tmp, "from-flag.d.ts");
			await writeFile(
				path.join(tmp, "package.json"),
				JSON.stringify({
					name: "tmp-cli-fixture",
					slothlet: { typegen: { dir: API_FIXTURE, output: pkgOut, interfaceName: "PkgName" } }
				}),
				"utf8"
			);
			const { code } = await runCli(["typegen", "--output", flagOut, "--interface-name", "FlagName"], { cwd: tmp });
			expect(code).toBe(0);
			expect(existsSync(flagOut)).toBe(true);
			expect(existsSync(pkgOut)).toBe(false);
			const content = await readFile(flagOut, "utf8");
			expect(content).toContain("interface FlagName");
		});

		it("treats unparseable package.json as empty fallback (errors with missing-option, not crash)", async () => {
			const tmp = await freshTempDir();
			await writeFile(path.join(tmp, "package.json"), "{ invalid json", "utf8");
			const { code, stderr } = await runCli(["typegen", "--dir", API_FIXTURE], { cwd: tmp });
			// Still missing output + interfaceName → clean error, not a parse crash.
			expect(code).not.toBe(0);
			expect(stderr).toMatch(/missing required option/i);
		});
	});

	describe("typegen validation", () => {
		it("errors when no args and package.json has no slothlet.typegen", async () => {
			const tmp = await freshTempDir();
			await writeFile(path.join(tmp, "package.json"), JSON.stringify({ name: "tmp" }), "utf8");
			const { code, stderr } = await runCli(["typegen"], { cwd: tmp });
			expect(code).not.toBe(0);
			expect(stderr).toMatch(/missing required option/i);
		});

		it("errors when only some required options are provided", async () => {
			const tmp = await freshTempDir();
			await writeFile(path.join(tmp, "package.json"), JSON.stringify({ name: "tmp" }), "utf8");
			const { code, stderr } = await runCli(["typegen", "--dir", API_FIXTURE], { cwd: tmp });
			expect(code).not.toBe(0);
			expect(stderr).toMatch(/missing required option/i);
			expect(stderr).toMatch(/output/);
			expect(stderr).toMatch(/interfaceName/);
		});

		it("errors on unknown flag", async () => {
			const { code, stderr } = await runCli(["typegen", "--bogus", "x", "--dir", API_FIXTURE]);
			expect(code).not.toBe(0);
			expect(stderr).toMatch(/unknown option/i);
		});

		it("errors when a flag is given no value", async () => {
			const { code, stderr } = await runCli(["typegen", "--dir"]);
			expect(code).not.toBe(0);
			expect(stderr).toMatch(/requires a value/i);
		});
	});
});

function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
