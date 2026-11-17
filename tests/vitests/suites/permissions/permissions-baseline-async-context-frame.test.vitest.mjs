/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-baseline-async-context-frame.test.vitest.mjs
 *	@Date: 2026-11-17T08:00:00-08:00 (1794931200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T08:00:00-08:00 (1794931200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `async-context-frame` baseline check: Node's `AsyncContextFrame` is on.
 *
 * @description
 * Where the frame is off (Node 22's default, or Node 24 and later run with `--no-async-context-frame`), Node keeps what
 * an `AsyncLocalStorage` holds on async resources module code can reach. The check tells by trying it, never by reading
 * the flags, so a child process is started with the frame on and off on the Node running the suite (on Node 22:
 * `--experimental-async-context-frame` or nothing; on Node 24 and later: nothing or `--no-async-context-frame`, on the
 * command line and through `NODE_OPTIONS`). Under "on" a frame that is off is one warning and the instance starts;
 * under "strict" it refuses with `PERMISSION_BASELINE_UNMET` naming the check; under "off" and "disabled" no check runs.
 * The check against stand-in probes runs in this process.
 * @module tests/vitests/suites/permissions/permissions-baseline-async-context-frame
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runBaseline } from "#helpers/permission-baseline";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const ROOT = path.join(REPO, "tmp", "permissions-baseline-async-context-frame");
const CHILD = path.join(ROOT, "child.mjs");
const BASE = path.join(REPO, "api_tests", "api_test_stack_settings", "api");
const MAJOR = Number(process.versions.node.split(".")[0]);
/** Node flags for a child with the frame on, and with it off. */
const FRAME_ON = MAJOR < 24 ? ["--experimental-async-context-frame"] : [];
const FRAME_OFF = MAJOR < 24 ? [] : ["--no-async-context-frame"];
/** The fix the reason names on this Node. */
const FIX = MAJOR < 24 ? "--experimental-async-context-frame" : "--no-async-context-frame";

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(ROOT, { recursive: true });
	writeFileSync(
		CHILD,
		[
			'import slothlet from "@cldmv/slothlet";',
			"const [mode, base] = process.argv.slice(2);",
			"const out = {};",
			"let api = null;",
			"try {",
			'\tapi = await slothlet({ base, permissions: { mode, policy: "allow" } });',
			'\tout.start = "started";',
			"} catch (error) {",
			"\tout.start = error?.code ?? String(error);",
			"\tout.checks = error?.details?.checks ?? null;",
			"}",
			"if (api) {",
			"\tout.warnings = api.slothlet.warnings",
			"\t\t.get()",
			'\t\t.filter((warning) => warning.code === "WARNING_PERMISSION_BASELINE_UNMET")',
			"\t\t.map((warning) => warning.details?.check ?? null);",
			"\tout.baseline = api.slothlet.permissions.control.report().baseline;",
			"\tawait api.shutdown();",
			"}",
			'process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");'
		].join("\n") + "\n"
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Start an instance in a child process and read what it saw.
 * @param {string} mode - The permissions mode.
 * @param {string[]} flags - Node flags.
 * @param {object} [env] - Extra environment.
 * @returns {object} What the child printed.
 */
function child(mode, flags, env = {}) {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", ...flags, CHILD, mode, BASE], {
		encoding: "utf8",
		timeout: 120_000,
		env: { ...process.env, NODE_OPTIONS: "", ...env }
	});
	const line = result.stdout.split("\n").find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`child gave no result (status ${result.status}): ${result.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe("permissions baseline > async-context-frame > a child process", () => {
	it("under on with the frame on: the check is met, nothing is warned", () => {
		expect(child("on", FRAME_ON)).toEqual({
			start: "started",
			warnings: [],
			baseline: { met: true, checks: [{ id: "async-context-frame", met: true, reason: null }] }
		});
	});

	it("under on with the frame off: one warning for the check, and the instance starts", () => {
		const out = child("on", FRAME_OFF);
		expect(out.start).toBe("started");
		expect(out.warnings).toEqual(["async-context-frame"]);
		expect(out.baseline).toEqual({
			met: false,
			checks: [{ id: "async-context-frame", met: false, reason: expect.stringContaining(FIX) }]
		});
	});

	it("under strict with the frame on: starts", () => {
		expect(child("strict", FRAME_ON)).toMatchObject({
			start: "started",
			baseline: { met: true, checks: [{ id: "async-context-frame", met: true, reason: null }] }
		});
	});

	it("under strict with the frame off: refuses with PERMISSION_BASELINE_UNMET naming the check", () => {
		expect(child("strict", FRAME_OFF)).toEqual({ start: "PERMISSION_BASELINE_UNMET", checks: "async-context-frame" });
	});

	it.runIf(MAJOR >= 24)("tells a frame turned off through NODE_OPTIONS, which no flag parse of the command line sees", () => {
		expect(child("strict", [], { NODE_OPTIONS: "--no-async-context-frame" })).toEqual({
			start: "PERMISSION_BASELINE_UNMET",
			checks: "async-context-frame"
		});
	});

	it.each(["off", "disabled"])("under %s with the frame off: no check runs", (mode) => {
		expect(child(mode, FRAME_OFF)).toEqual({ start: "started", warnings: [], baseline: { met: null, checks: [] } });
	});
});

describe("permissions baseline > async-context-frame > stand-in probes", () => {
	const probes = (extra) => ({
		codeFromStringsRefused: () => true,
		importRefused: async () => true,
		vitestWorker: null,
		viteRecords: () => 0,
		...extra
	});

	it("is met when the probe finds the frame on, and not met (with a reason) when off", async () => {
		expect(await runBaseline("node", probes({ asyncContextFrameOn: () => true }))).toEqual({
			met: true,
			checks: [{ id: "async-context-frame", met: true, reason: null }]
		});
		expect(await runBaseline("node", probes({ asyncContextFrameOn: () => false }))).toEqual({
			met: false,
			checks: [{ id: "async-context-frame", met: false, reason: expect.stringContaining("AsyncContextFrame") }]
		});
	});

	it("takes a probe that throws as not met", async () => {
		const out = await runBaseline(
			"node",
			probes({
				asyncContextFrameOn: () => {
					throw new Error("probe");
				}
			})
		);
		expect(out).toEqual({ met: false, checks: [{ id: "async-context-frame", met: false, reason: expect.any(String) }] });
	});

	it("is not a check where there is no node:async_hooks to test, nor in a browser", async () => {
		expect(await runBaseline("node", probes({ asyncContextFrameOn: null }))).toEqual({ met: true, checks: [] });
		const browser = await runBaseline("browser", probes({ asyncContextFrameOn: () => false }));
		expect(browser.checks.map((entry) => entry.id)).toEqual(["csp-eval", "csp-blob-script", "csp-data-script"]);
	});

	it("comes before vitest-plugin under vitest", async () => {
		const out = await runBaseline("node", probes({ asyncContextFrameOn: () => true, vitestWorker: {}, viteRecords: () => 1 }));
		expect(out.checks.map((entry) => entry.id)).toEqual(["async-context-frame", "vitest-plugin"]);
	});
});
