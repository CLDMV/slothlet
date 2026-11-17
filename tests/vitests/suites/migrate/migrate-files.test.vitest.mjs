/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/migrate/migrate-files.test.vitest.mjs
 *	@Date: 2026-11-16T16:20:41-08:00 (1794874841)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:29:20-08:00 (1794875360)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet-migrate: slothlet.module.json, package.json, files on disk, the diff and the CLI.
 * @module tests/vitests/suites/migrate/migrate-files.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	collectFiles,
	migrateFile,
	migrateJson,
	rewriteTypegenCommand,
	unifiedDiff
} from "../../../../packaging/slothlet-migrate/src/index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.resolve(here, "../../../../packaging/slothlet-migrate/bin/slothlet-migrate.mjs");

describe("slothlet-migrate: slothlet.module.json", () => {
	it("rewrites format 1 to format 2, rule targets included", () => {
		const text = `{\n\t"schemaVersion": 1,\n\t"mountPath": ["drivers", "pg"],\n\t"apiDir": "./dist/api",\n\t"permissions": [{ "caller": "**", "target": "slothlet.diag.getOwnership", "effect": "deny" }]\n}\n`;
		const res = migrateJson(text, { filename: "pkg/slothlet.module.json" });
		expect(res.code).toBe(
			`{\n\t"schema": 2,\n\t"mount": ["drivers", "pg"],\n\t"base": "./dist/api",\n\t"permissions": [{ "caller": "**", "target": "slothlet.diag.owner.list", "effect": "deny" }]\n}\n`
		);
		expect(migrateJson(res.code, { filename: "slothlet.module.json" }).findings).toEqual([]);
	});

	it("reports an unexpected schemaVersion", () => {
		const res = migrateJson(`{ "schemaVersion": 3, "mountPath": "a", "apiDir": "b" }`, { filename: "slothlet.module.json" });
		expect(res.code).toBe(`{ "schemaVersion": 3, "mount": "a", "base": "b" }`);
		expect(res.findings.filter((f) => f.level === "manual").map((f) => f.entry)).toEqual(["manifest|slothlet.module.json:schemaVersion"]);
	});
});

describe("slothlet-migrate: package.json", () => {
	it("rewrites the typegen fallback keys and CLI flags in scripts", () => {
		const text = `{\n  "scripts": {\n    "types": "slothlet typegen --dir ./api --interface-name Api --no-augment-runtime && tsc",\n    "other": "node -d x"\n  },\n  "slothlet": { "typegen": { "dir": "./api", "interfaceName": "Api" } }\n}\n`;
		const res = migrateJson(text, { filename: "package.json" });
		expect(res.code).toBe(
			`{\n  "scripts": {\n    "types": "slothlet typegen --base ./api --name Api --no-augment && tsc",\n    "other": "node -d x"\n  },\n  "slothlet": { "typegen": { "base": "./api", "name": "Api" } }\n}\n`
		);
	});

	it("only touches flags of the slothlet typegen command", () => {
		expect(rewriteTypegenCommand("x -d && slothlet typegen -d api --output=o; y --dir").text).toBe(
			"x -d && slothlet typegen -b api --output=o; y --dir"
		);
		expect(rewriteTypegenCommand("slothlet typegen --dir=api").text).toBe("slothlet typegen --base=api");
	});

	it("leaves an unrelated package.json alone", () => {
		const text = `{ "name": "x", "scripts": { "test": "vitest" } }`;
		expect(migrateJson(text, { filename: "package.json" })).toMatchObject({ code: text, changed: false, findings: [] });
	});
});

describe("slothlet-migrate: diff", () => {
	it("prints a unified diff with context", () => {
		const diff = unifiedDiff("a\nb\nc\n", "a\nB\nc\n", "f.mjs");
		expect(diff).toBe("--- a/f.mjs\n+++ b/f.mjs\n@@ -1,4 +1,4 @@\n a\n-b\n+B\n c\n \n");
		expect(unifiedDiff("same", "same", "f.mjs")).toBe("");
	});
});

describe("slothlet-migrate: files on disk and the CLI", () => {
	let dir;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "slothlet-migrate-"));
		fs.mkdirSync(path.join(dir, "src"));
		fs.mkdirSync(path.join(dir, "node_modules", "x"), { recursive: true });
		fs.writeFileSync(
			path.join(dir, "src", "app.mjs"),
			`import slothlet from "@cldmv/slothlet";\nexport const api = await slothlet({ dir: "./api", permissions: { defaultPolicy: "deny" } });\napi.slothlet.lockCaller(fn);\n`
		);
		fs.writeFileSync(path.join(dir, "src", "types.ts"), `const x: number = 1;\n`);
		fs.writeFileSync(path.join(dir, "node_modules", "x", "i.mjs"), `slothlet({ dir: "x" });\n`);
		fs.writeFileSync(path.join(dir, "slothlet.module.json"), `{ "schemaVersion": 1, "mountPath": "a", "apiDir": "b" }\n`);
		fs.writeFileSync(path.join(dir, "cfg.json"), `{ "apiDepth": 2 }\n`);
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("collects JavaScript, manifests and config files; skips node_modules and lists TypeScript", () => {
		const cfg = path.join(dir, "cfg.json");
		const { files, skipped } = collectFiles([dir], new Set([cfg]));
		expect(files.map((f) => path.relative(dir, f)).sort()).toEqual(
			["cfg.json", "slothlet.module.json", path.join("src", "app.mjs")].sort()
		);
		expect(skipped.map((f) => path.relative(dir, f))).toEqual([path.join("src", "types.ts")]);
	});

	it("migrateFile is a dry run unless write is set", () => {
		const file = path.join(dir, "src", "app.mjs");
		const before = fs.readFileSync(file, "utf8");
		const dry = migrateFile(file, { cwd: dir });
		expect(dry.changed).toBe(true);
		expect(dry.diff).toContain("+export const api = await slothlet({ base:");
		expect(fs.readFileSync(file, "utf8")).toBe(before);
		migrateFile(file, { cwd: dir, write: true });
		expect(fs.readFileSync(file, "utf8")).toBe(
			`import slothlet from "@cldmv/slothlet";\nexport const api = await slothlet({ base: "./api", permissions: { policy: "deny" } });\napi.slothlet.pin(fn);\n`
		);
	});

	it("CLI: dry run prints the diff and findings; --write applies; --json is machine-readable", () => {
		const out = execFileSync(process.execPath, [BIN, ".", "--config", "cfg.json"], { cwd: dir, encoding: "utf8" });
		expect(out).toContain("--- a/src/app.mjs");
		expect(out).toContain("src/app.mjs:2:37  rewrite dir → base");
		expect(out).toContain("Would rewrite 3 file(s)");
		expect(out).toContain("1 TypeScript file(s) not rewritten");
		expect(fs.readFileSync(path.join(dir, "cfg.json"), "utf8")).toBe(`{ "apiDepth": 2 }\n`);

		const quiet = execFileSync(process.execPath, [BIN, "src", "--no-diff", "--no-info"], { cwd: dir, encoding: "utf8" });
		expect(quiet).not.toContain("---");
		expect(quiet).not.toContain(" info ");

		const json = JSON.parse(execFileSync(process.execPath, [BIN, "--json", "--config=cfg.json"], { cwd: dir, encoding: "utf8" }));
		expect(json.write).toBe(false);
		expect(json.files.map((f) => f.file)).toEqual(["cfg.json"]);
		expect(json.files[0].findings.find((f) => f.level === "rewrite")).toMatchObject({ entry: "config|apiDepth", line: 1 });

		execFileSync(process.execPath, [BIN, ".", "--write", "--config", "cfg.json"], { cwd: dir, encoding: "utf8" });
		expect(fs.readFileSync(path.join(dir, "cfg.json"), "utf8")).toBe(`{ "depth": 2 }\n`);
		expect(fs.readFileSync(path.join(dir, "slothlet.module.json"), "utf8")).toBe(`{ "schema": 2, "mount": "a", "base": "b" }\n`);
		expect(fs.readFileSync(path.join(dir, "node_modules", "x", "i.mjs"), "utf8")).toBe(`slothlet({ dir: "x" });\n`);
	});

	it("CLI: help, bad options and parse failures", () => {
		expect(execFileSync(process.execPath, [BIN, "--help"], { encoding: "utf8" })).toContain("Usage: slothlet-migrate");
		const bad = (() => {
			try {
				execFileSync(process.execPath, [BIN, "--nope"], { cwd: dir, encoding: "utf8", stdio: "pipe" });
				return 0;
			} catch (error) {
				return error.status;
			}
		})();
		expect(bad).toBe(2);
		fs.writeFileSync(path.join(dir, "src", "broken.mjs"), "const = ;\n");
		let status = 0;
		let stdout = "";
		try {
			execFileSync(process.execPath, [BIN, "src"], { cwd: dir, encoding: "utf8", stdio: "pipe" });
		} catch (error) {
			status = error.status;
			stdout = error.stdout;
		}
		expect(status).toBe(1);
		expect(stdout).toContain("src/broken.mjs: could not parse");
	});
});
