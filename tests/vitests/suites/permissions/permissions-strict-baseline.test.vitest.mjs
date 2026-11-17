/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-strict-baseline.test.vitest.mjs
 *	@Date: 2026-11-16T03:00:00-08:00 (1794826800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:17:23-08:00 (1794874643)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions.mode: "strict"` and the baseline checks an instance runs as it starts.
 *
 * @description
 * Strict is chosen in the config only: it behaves as "on" for every check, `control.enable()` and `control.disable()`
 * refuse to leave it, and the instance refuses to start while a baseline check is not met. Under "on" each check that
 * is not met is one warning naming it. `control.report()` gives the mode, the baseline and the capabilities the rules open
 * (an empty list until capabilities are built).
 *
 * On Node the baseline is empty outside vitest and `vitest-plugin` under it (the `slothletInstanceImports()` plugin's
 * records seen). The baseline holds only what slothlet needs to tell the caller and refuse correctly:
 * `--disallow-code-generation-from-strings` is recommended hardening, not a check, as slothlet tells `eval` and
 * `Function` code apart and refuses it without the flag; slothlet's own stack realm is always there on supported Node,
 * and without it caller checks fail closed. The process is started in child
 * processes (`api_tests/api_test_permissions_strict/child.mjs`) with and without the flag; the vitest check runs here,
 * where the repository's config loads the plugin, and against stand-in probes for the plugin being absent. The browser
 * checks run in `tests/browser/permissions-baseline-*.browser.test.mjs`.
 *
 * Rows changed by the ruling that removed `node-code-generation` from the baseline (2026-11-16): strict without the flag
 * starts (was: refused); under on without the flag nothing is warned (was: one warning for `node-code-generation`); the
 * reports list `node-stack-realm` (and `vitest-plugin` under vitest) only; under vitest strict starts (was: refused);
 * the stand-in rows drop `node-code-generation`.
 *
 * Rows changed by the ruling that removed `node-stack-realm` from the baseline (2026-11-16): the Node reports list no
 * check outside vitest (was: `node-stack-realm`) and `vitest-plugin` alone under vitest; the stand-in row for a missing
 * realm is gone, and the row for a probe that throws uses the vitest check.
 * @module tests/vitests/suites/permissions/permissions-strict-baseline
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { normalizePermissionsConfig } from "#helpers/config";
import { runBaseline } from "#helpers/permission-baseline";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const CHILD = path.join(ROOT, "api_tests", "api_test_permissions_strict", "child.mjs");
const BASE = path.join(ROOT, "api_tests", "api_test_stack_settings", "api");
const RULES = [
	{ caller: "settler.**", target: "vault.**", effect: "deny" },
	{ caller: "**", target: "only.**", effect: "deny" },
	{ caller: "good.**", target: "only.**", effect: "allow" }
];
const CONFIGS = ["eager", "lazy"].flatMap((loading) => ["async", "live"].map((runtime) => ({ loading, runtime })));

/**
 * Start an instance in a child process and read what it saw.
 * @param {string} mode - The permissions mode.
 * @param {{loading: string, runtime: string}} config - Eager or lazy, async or live.
 * @param {string[]} [flags=[]] - Node flags.
 * @returns {object} What the child printed.
 */
function child(mode, { loading, runtime }, flags = []) {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", ...flags, CHILD, mode, loading, runtime], {
		encoding: "utf8",
		timeout: 120_000
	});
	const line = result.stdout.split("\n").find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`child gave no result (status ${result.status}): ${result.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

const NO_CODEGEN = ["--disallow-code-generation-from-strings"];
/** `capabilities` is the permission manager's list of capabilities and the callers rules open each to. */
const MET_NODE = {
	mode: "strict",
	baseline: {
		met: true,
		checks: []
	},
	capabilities: expect.any(Array)
};

describe("permissions mode strict > config", () => {
	it("is accepted as a mode and as the shorthand, and counts as on", () => {
		expect(normalizePermissionsConfig({ mode: "strict" })).toMatchObject({ mode: "strict", enabled: true });
		expect(normalizePermissionsConfig("strict")).toMatchObject({ mode: "strict", enabled: true });
	});

	it("still refuses an unknown mode", () => {
		expect(() => normalizePermissionsConfig({ mode: "locked" })).toThrow(expect.objectContaining({ code: "INVALID_CONFIG" }));
	});
});

describe.each(CONFIGS)("permissions mode strict > Node, a child process > $loading / $runtime", (config) => {
	it.each([
		["without", []],
		["with", NO_CODEGEN]
	])("starts %s --disallow-code-generation-from-strings, applies every rule, and cannot be left at runtime", (_label, flags) => {
		expect(child("strict", config, flags)).toEqual({
			start: "started",
			warnings: [],
			report: MET_NODE,
			mode: "strict",
			good: "GOOD-ONLY",
			settler: "PERMISSION_DENIED",
			disable: "PERMISSION_STRICT_FIXED",
			enable: "PERMISSION_STRICT_FIXED",
			modeAfter: "strict",
			settlerAfter: "PERMISSION_DENIED"
		});
	});

	it("under on, warns nothing without the flag, and the runtime switches work", () => {
		const out = child("on", config);
		expect(out.start).toBe("started");
		expect(out.warnings).toEqual([]);
		expect(out.report).toEqual({ ...MET_NODE, mode: "on" });
		expect([out.good, out.settler]).toEqual(["GOOD-ONLY", "PERMISSION_DENIED"]);
		// Off, then on again.
		expect([out.disable, out.enable, out.modeAfter, out.settlerAfter]).toEqual([undefined, undefined, "on", "PERMISSION_DENIED"]);
	});

	it.each(["off", "disabled"])("under %s, runs no check and warns nothing", (mode) => {
		const out = child(mode, config);
		expect(out.warnings).toEqual([]);
		expect(out.report).toEqual({ mode, baseline: { met: null, checks: [] }, capabilities: expect.any(Array) });
	});
});

describe("permissions mode strict > under vitest with the plugin", () => {
	let api = null;
	const UNDER_VITEST = {
		met: true,
		checks: [{ id: "vitest-plugin", met: true, reason: null }]
	};

	afterEach(async () => {
		SlothletWarning.captured.length = 0;
		await api?.shutdown();
		api = null;
	});

	it("starts under strict with the plugin's records seen", async () => {
		api = await slothlet({ base: BASE, silent: true, permissions: { mode: "strict", rules: RULES } });
		expect(api.slothlet.permissions.control.report()).toEqual({ mode: "strict", baseline: UNDER_VITEST, capabilities: expect.any(Array) });
		expect(await api.good.readOnly()).toBe("GOOD-ONLY");
	});

	it("under on, reports every check met and warns nothing", async () => {
		api = await slothlet({ base: BASE, permissions: { mode: "on", rules: RULES } });
		expect(api.slothlet.permissions.control.report()).toEqual({ mode: "on", baseline: UNDER_VITEST, capabilities: expect.any(Array) });
		expect(SlothletWarning.captured.filter((warning) => warning.code === "WARNING_PERMISSION_BASELINE_UNMET")).toEqual([]);
	});
});

describe("permissions baseline > the checks, against stand-in probes", () => {
	const probes = (extra) => ({
		codeFromStringsRefused: () => true,
		importRefused: async () => true,
		vitestWorker: null,
		viteRecords: () => 0,
		...extra
	});

	it("on Node without vitest: no check, whether code from strings is refused or not", async () => {
		for (const refused of [true, false]) {
			expect(await runBaseline("node", probes({ codeFromStringsRefused: () => refused }))).toEqual({ met: true, checks: [] });
		}
	});

	it("under vitest: the plugin's records seen, or not", async () => {
		const seen = await runBaseline("node", probes({ vitestWorker: {}, viteRecords: () => 3 }));
		expect(seen).toEqual({ met: true, checks: [{ id: "vitest-plugin", met: true, reason: null }] });
		const absent = await runBaseline("node", probes({ vitestWorker: {}, viteRecords: () => 0 }));
		expect(absent).toEqual({
			met: false,
			checks: [{ id: "vitest-plugin", met: false, reason: expect.any(String) }]
		});
		const unknown = await runBaseline("node", probes({ vitestWorker: {}, viteRecords: () => null }));
		expect(unknown.checks[0].met).toBe(false);
	});

	it("in a browser: code from strings, blob: and data: scripts", async () => {
		const asked = [];
		const all = await runBaseline(
			"browser",
			probes({
				codeFromStringsRefused: () => false,
				importRefused: async (kind) => (asked.push(kind), kind === "blob")
			})
		);
		expect(asked).toEqual(["blob", "data"]);
		expect(all).toEqual({
			met: false,
			checks: [
				{ id: "csp-eval", met: false, reason: expect.any(String) },
				{ id: "csp-blob-script", met: true, reason: null },
				{ id: "csp-data-script", met: false, reason: expect.any(String) }
			]
		});
	});

	it("takes a probe that throws as a check not met", async () => {
		const out = await runBaseline(
			"node",
			probes({
				vitestWorker: {},
				viteRecords: () => {
					throw new Error("probe");
				}
			})
		);
		expect(out).toEqual({ met: false, checks: [{ id: "vitest-plugin", met: false, reason: expect.any(String) }] });
	});
});
