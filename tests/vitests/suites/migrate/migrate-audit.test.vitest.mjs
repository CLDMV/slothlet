/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/migrate/migrate-audit.test.vitest.mjs
 *	@Date: 2026-11-16T19:01:06-08:00 (1794884466)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:26:24-08:00 (1794929184)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet-migrate audit: surface findings from the engine's data, the audit-only data-shape
 * checks, the folder walk, the JSON output and the exit codes.
 * @module tests/vitests/suites/migrate/migrate-audit.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { audit, auditJson, auditSource } from "../../../../packaging/slothlet-migrate/src/index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.resolve(here, "../../../../packaging/slothlet-migrate/bin/slothlet-migrate.mjs");

/**
 * Audit a snippet and return `line level entry` triples.
 * @param {string} code - Source.
 * @returns {string[]} Findings as `<line>:<level>:<entry>`.
 */
function run(code) {
	const res = auditSource(code, { filename: "a.mjs" });
	expect(res.error).toBeNull();
	return res.findings.filter((f) => f.level !== "info").map((f) => `${f.line}:${f.level}:${f.entry}`);
}

describe("slothlet-migrate audit: v3 surface (from the engine's data)", () => {
	it("lists member chains, nodes and removed subpath imports", () => {
		const out = run(
			[
				`import { x } from "@cldmv/slothlet/helpers/resolve-from-caller";`,
				`const a = await api.slothlet.metadata.getFor("a");`,
				`self.slothlet.lockCaller;`,
				`use(node.__type);`
			].join("\n")
		);
		expect(out).toEqual([
			"1:manual:export|@cldmv/slothlet/helpers/resolve-from-caller",
			"2:fixable:method|api.slothlet.metadata.getFor",
			"3:fixable:method|api.slothlet.lockCaller",
			"4:manual:node-field|<node>.__type"
		]);
	});

	it("carries the v4 replacement", () => {
		const res = auditSource(`await api.slothlet.metadata.getFor("a");`, { filename: "a.mjs" });
		expect(res.findings[0]).toMatchObject({ kind: "surface", level: "fixable", new: "api.slothlet.metadata.get", line: 1, column: 20 });
	});

	it("lists config keys and error codes", () => {
		const out = run(
			`import slothlet from "@cldmv/slothlet";\nawait slothlet({ dir: "./api" });\nif (err.code === "INVALID_CONFIG_DIR_MISSING") x();`
		);
		expect(out.some((o) => o.startsWith("2:fixable:config|dir"))).toBe(true);
		expect(out.some((o) => o.startsWith("3:fixable:code|INVALID_CONFIG_DIR_MISSING"))).toBe(true);
	});

	it("is clean for v4 code", () => {
		expect(run(`import slothlet from "@cldmv/slothlet";\nawait slothlet({ base: "./api" });\napi.slothlet.metadata.get("a");`)).toEqual([]);
	});

	it("audits JSON documents", () => {
		const res = auditJson(`{ "schemaVersion": 1, "mountPath": "a", "apiDir": "b" }`, { filename: "slothlet.module.json" });
		expect(res.findings.map((f) => f.level)).toEqual(["fixable", "fixable", "fixable"]);
		expect(auditJson("{ nope", { filename: "package.json" }).error).toBeTruthy();
	});
});

describe("slothlet-migrate audit: data shapes (report-only)", () => {
	const data = (code) => auditSource(code, { filename: "d.mjs" }).findings.filter((f) => f.kind === "data");

	it("event strategy envelope and listener meta", () => {
		const f = data(
			[
				`api.slothlet.event.strategy((envelope, listeners, deliver) => {`,
				`	use(envelope.instanceID, envelope.emitter.moduleID, envelope.emitter.apiPath);`,
				`});`,
				`api.slothlet.event.on("x", (payload, meta) => use(meta.instanceID));`
			].join("\n")
		);
		expect(f.map((x) => [x.line, x.new])).toEqual([
			[2, "instance"],
			[2, "emitter.module"],
			[2, "emitter.path"],
			[4, "instance"]
		]);
		expect(f.every((x) => x.level === "manual")).toBe(true);
	});

	it("lifecycle payloads, including destructured parameters and permission audit conditionMatched", () => {
		const f = data(
			[
				`api.slothlet.lifecycle.on("impl:created", ({ filePath, moduleID, apiPath }) => use(filePath));`,
				`api.slothlet.lifecycle.on("permission:denied", (e) => use(e.conditionMatched, e.timestamp));`,
				`api.slothlet.lifecycle.on("restarted", (e) => { const { previousInstanceID } = e; });`
			].join("\n")
		);
		expect(f.map((x) => `${x.line}:${x.new ?? "removed"}`)).toEqual(["1:file", "1:module", "1:path", "2:removed", "2:at", "3:previous"]);
		expect(f[3].message).toContain("e.rule.condition != null");
	});

	it("lifecycle source values", () => {
		const f = data(
			`api.slothlet.lifecycle.on("impl:created", (e) => { if (e.source === "addApi") x(); if (e.via === "checkCall") y(); });`
		);
		expect(f.map((x) => x.new)).toEqual(['source === "add"', 'via === "check.call"']);
	});

	it("hook contexts: hasError, errorType, source", () => {
		const f = data(
			[
				`api.slothlet.hook.on("always:**", (ctx) => use(ctx.hasError));`,
				`api.slothlet.hook.on("error:**", (ctx) => use(ctx.errorType, ctx.timestamp, ctx.source.hookId));`
			].join("\n")
		);
		expect(f.map((x) => `${x.line}:${x.new ?? "removed"}`)).toEqual(["1:removed", "2:class", "2:at", "2:origin.hook"]);
	});

	it("error details read through err.context / err.details and destructuring", () => {
		const f = data(
			[
				`try { x(); } catch (err) {`,
				`	use(err.context.moduleID, err.details.apiPath, err.context.validationError);`,
				`	const { filePath, packageName } = err.context;`,
				`}`
			].join("\n")
		);
		expect(f.map((x) => `${x.line}:${x.new ?? "removed"}`)).toEqual(["2:module", "2:path", "2:removed", "3:file", "3:package"]);
	});

	it("diagnostics results and distinctive diagnostics names", () => {
		const f = data(
			[
				`const info = await api.slothlet.diag.inspect();`,
				`use(info.isLoaded, info.context.instances);`,
				`const ctx = await api.slothlet.context.diagnostics();`,
				`use(ctx.baseContext, ctx.storeFromInstancesMap.createdAt, ctx.instancesMapSize);`,
				`const caches = await api.slothlet.diag.caches.get();`,
				`use(caches.totalCaches, caches.caches[0].pathCount);`,
				`use(somewhere.conflictedPaths);`
			].join("\n")
		);
		expect(f.map((x) => `${x.line}:${x.new ?? "removed"}`)).toEqual([
			"2:loaded",
			"2:removed",
			"4:base",
			"4:at",
			"4:removed",
			"6:removed",
			"6:count",
			"7:conflicts"
		]);
	});

	it("does not flag the same names on unrelated objects", () => {
		expect(
			data(
				[
					`const user = { moduleID: "x", apiPath: "y", hasError: false };`,
					`use(user.moduleID, user.hasError, config.filePath);`,
					`app.on("x", (payload) => use(payload.moduleID));`,
					`try {} catch (boom) { use(boom.moduleID); }`
				].join("\n")
			)
		).toEqual([]);
	});
});

describe("slothlet-migrate audit: folders, JSON output and exit codes", () => {
	let dir;
	beforeEach(() => {
		const base = path.resolve(here, "../../../../tmp/agents/v4-g2");
		fs.mkdirSync(base, { recursive: true });
		dir = fs.mkdtempSync(path.join(base, "audit-"));
	});
	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	const cli = (...args) => spawnSync(process.execPath, [BIN, "audit", ...args], { cwd: dir, encoding: "utf8" });

	it("walks a folder, skips node_modules, exits 1 and prints file:line", () => {
		fs.mkdirSync(path.join(dir, "src"));
		fs.mkdirSync(path.join(dir, "node_modules"));
		fs.writeFileSync(
			path.join(dir, "src", "app.mjs"),
			`import slothlet from "@cldmv/slothlet";\nawait slothlet({ dir: "./api" });\nuse(node.__type);\n`
		);
		fs.writeFileSync(path.join(dir, "node_modules", "dep.mjs"), `use(node.__type);\n`);
		fs.writeFileSync(path.join(dir, "slothlet.module.json"), `{ "schemaVersion": 1, "mountPath": "a", "apiDir": "b" }\n`);
		const res = cli();
		expect(res.status).toBe(1);
		expect(res.stdout).toContain("src/app.mjs:2:");
		expect(res.stdout).toContain("src/app.mjs:3:");
		expect(res.stdout).toContain("slothlet.module.json:1:");
		expect(res.stdout).not.toContain("node_modules");
		expect(res.stdout).toMatch(/\d+ v3 use\(s\) in 2 file\(s\)/);
	});

	it("exits 0 for a clean tree", () => {
		fs.writeFileSync(path.join(dir, "ok.mjs"), `import slothlet from "@cldmv/slothlet";\nawait slothlet({ base: "./api" });\n`);
		const res = cli();
		expect(res.status).toBe(0);
		expect(res.stdout).toContain("No v3 surface found in 1 file(s).");
	});

	it("never writes", () => {
		const file = path.join(dir, "app.mjs");
		const text = `import slothlet from "@cldmv/slothlet";\nawait slothlet({ dir: "./api" });\n`;
		fs.writeFileSync(file, text);
		expect(cli().status).toBe(1);
		expect(fs.readFileSync(file, "utf8")).toBe(text);
		expect(cli("--write").status).toBe(2);
	});

	it("--json prints the report", () => {
		fs.writeFileSync(path.join(dir, "app.mjs"), `use(node.__type);\nawait api.slothlet.metadata.getFor("a");\n`);
		const res = cli("--json");
		expect(res.status).toBe(1);
		const out = JSON.parse(res.stdout);
		expect(out.clean).toBe(false);
		expect(out.files).toBe(1);
		expect(out.counts).toMatchObject({ fixable: 1, manual: 1 });
		expect(out.findings.map((f) => [f.file, f.line, f.level, f.kind])).toEqual([
			["app.mjs", 1, "manual", "surface"],
			["app.mjs", 2, "fixable", "surface"]
		]);
		expect(out.findings[1].new).toBe("api.slothlet.metadata.get");
	});

	it("--json on a clean tree is clean and exits 0", () => {
		fs.writeFileSync(path.join(dir, "ok.mjs"), `export const x = 1;\n`);
		const res = cli("--json");
		expect(res.status).toBe(0);
		expect(JSON.parse(res.stdout)).toMatchObject({ clean: true, findings: [] });
	});

	it("--info lists behaviour notes without changing the exit code", () => {
		fs.writeFileSync(path.join(dir, "ok.mjs"), `import slothlet from "@cldmv/slothlet";\nawait slothlet({ base: "./api" });\n`);
		expect(cli("--info").status).toBe(0);
	});

	it("exits 2 for a file that cannot be parsed", () => {
		fs.writeFileSync(path.join(dir, "bad.mjs"), `const = ;\n`);
		const res = cli();
		expect(res.status).toBe(2);
		expect(res.stdout).toContain("could not parse");
	});

	it("audit() takes absolute paths and a config file", () => {
		const cfg = path.join(dir, "cfg.json");
		fs.writeFileSync(cfg, `{ "dir": "./api" }`);
		const report = audit([], { cwd: dir, configs: new Set([cfg]) });
		expect(report.findings.map((f) => f.entry)).toEqual(["config|dir"]);
	});
});
