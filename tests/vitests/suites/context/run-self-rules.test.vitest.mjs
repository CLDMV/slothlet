/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/run-self-rules.test.vitest.mjs
 *	@Date: 2026-11-21T22:49:12-08:00 (1795330152)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:31-08:00 (1795869091)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Permission rules on `slothlet.context.run` and `slothlet.context.run.self` match as paths do: a rule on
 * `run` covers `run` and `run.self`, a rule on `run.self` applies to `run.self` calls only, and between two rules the
 * more specific one wins for the call it names, as for every other dotted target (a deny on `slothlet.permissions`
 * with an allow on `slothlet.permissions.rules.add` leaves the member open).
 *
 * Fixture (written at run time): `mod/mod.mjs`, added under `mod`, opens a run and a run.self from module code.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-self-rules");
const BASE = path.join(ROOT, "api");
const MOD = path.join(ROOT, "mod");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(BASE, { recursive: true });
	mkdirSync(MOD, { recursive: true });
	writeFileSync(path.join(BASE, "math.mjs"), "export function add(a, b) {\n\treturn a + b;\n}\n");
	writeFileSync(
		path.join(MOD, "mod.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export function viaRun() {",
			"\treturn self.slothlet.context.run({}, () => 'ran');",
			"}",
			"export function viaRunSelf() {",
			"\treturn self.slothlet.context.run.self({}, (view) => (view === self ? 'ran' : 'other'));",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * The error code `fn` throws or rejects with, or its result.
 * @param {Function} fn - The code.
 * @returns {Promise<string>} The code or the result.
 */
async function outcome(fn) {
	try {
		return await fn();
	} catch (error) {
		return error.code;
	}
}

describe.each([
	["async", "eager"],
	["async", "lazy"],
	["live", "eager"],
	["live", "lazy"]
])("run and run.self rule targets — %s runtime, %s mode", (runtime, mode) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Make an instance with permissions on and the given rules.
	 * @param {object[]} rules - Rules.
	 * @param {string} [policy] - Default policy.
	 * @returns {Promise<void>}
	 */
	async function make(rules, policy = "allow") {
		api = await slothlet({ base: BASE, runtime, mode, silent: true, permissions: { mode: "on", policy, rules } });
		await api.slothlet.api.add("mod", MOD);
	}

	it("a deny on run.self refuses run.self and leaves run open", async () => {
		await make([{ caller: "mod.**", target: "slothlet.context.run.self", effect: "deny" }]);
		expect(await outcome(() => api.mod.viaRun())).toBe("ran");
		expect(await outcome(() => api.mod.viaRunSelf())).toBe("PERMISSION_DENIED");
	});

	it("a deny on run refuses run and run.self", async () => {
		await make([{ caller: "mod.**", target: "slothlet.context.run", effect: "deny" }]);
		expect(await outcome(() => api.mod.viaRun())).toBe("PERMISSION_DENIED");
		expect(await outcome(() => api.mod.viaRunSelf())).toBe("PERMISSION_DENIED");
	});

	it("an allow on run.self wins over a deny on run for run.self, as the more specific rule", async () => {
		await make([
			{ caller: "mod.**", target: "slothlet.context.run", effect: "deny" },
			{ caller: "mod.**", target: "slothlet.context.run.self", effect: "allow" }
		]);
		expect(await outcome(() => api.mod.viaRun())).toBe("PERMISSION_DENIED");
		expect(await outcome(() => api.mod.viaRunSelf())).toBe("ran");
	});

	it("an allow on run.self alone opens run.self and not run under a deny policy", async () => {
		await make([{ caller: "mod.**", target: "slothlet.context.run.self", effect: "allow" }], "deny");
		expect(await outcome(() => api.mod.viaRun())).toBe("PERMISSION_DENIED");
		expect(await outcome(() => api.mod.viaRunSelf())).toBe("ran");
	});

	it("a deny on run.self wins over an allow on run for run.self", async () => {
		await make(
			[
				{ caller: "mod.**", target: "slothlet.context.run", effect: "allow" },
				{ caller: "mod.**", target: "slothlet.context.run.self", effect: "deny" }
			],
			"deny"
		);
		expect(await outcome(() => api.mod.viaRun())).toBe("ran");
		expect(await outcome(() => api.mod.viaRunSelf())).toBe("PERMISSION_DENIED");
	});
});
