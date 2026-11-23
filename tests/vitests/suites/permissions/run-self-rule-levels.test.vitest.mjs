/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/run-self-rule-levels.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T00:00:00-08:00 (1795334400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Rules on `slothlet.context.run.self` decide `run.self()` and `scope({ self: true })` whatever level
 * suffix their target carries, and a rule target with a level suffix opens the framework's namespace to module code
 * as the same target without it does.
 * @description
 * A rule target names a path and, after its last `:`, a level (`:call`, `:access`, `:full`, …). The level says which
 * operations the rule decides; the path is matched as it is without the suffix. So:
 * - a deny on `slothlet.context.run.self`, `…:call`, `…:access` or `…:full` refuses `run.self()` and leaves `run()`;
 * - a `:write` deny takes away writes alone, so `run.self()` is still decided by the rules on `run`;
 * - under `policy: "deny"`, an allow on `run.self` in any of those forms allows `run.self()` and not `run()`;
 * - `scope({ self: true })` hands over the view `run.self()` does, so it is decided under the rules on `run.self`
 *   (and through them the rules on `run`) as well as under those on `scope`; a plain `scope()` stays under the rules
 *   on `slothlet.context.scope` alone;
 * - an allow on `**:call` / `**:access` / `**:full` lets module code reach the namespace exactly as one on `**` does.
 * The bare target is the reference each suffixed one is held to. With the permission system off, no rule applies.
 *
 * Fixture (written at run time): `api/math.mjs`; `mod/mod.mjs`, added under `mod`, opens runs from module code.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-self-rule-levels");
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
			"\treturn self.slothlet.context.run({}, () => 'ok');",
			"}",
			"export function viaRunSelf() {",
			"\treturn self.slothlet.context.run.self({}, (view) => (view === self ? 'ok' : 'other view'));",
			"}",
			"export function viaScope() {",
			"\treturn self.slothlet.context.scope({ context: {}, fn: (...got) => (got.length === 0 ? 'ok' : 'handed something') });",
			"}",
			"export function viaScopeSelf() {",
			"\treturn self.slothlet.context.scope({ context: {}, self: true, fn: (view) => (view === self ? 'ok' : 'other view') });",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * The code a call throws, or "ok" / what it returns.
 * @param {Function} fn - The call.
 * @returns {Promise<string>} The outcome.
 */
async function codeOf(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

const D = "PERMISSION_DENIED";
const LEVELS = ["", ":call", ":access", ":full"];

describe.each([
	["async", "eager"],
	["async", "lazy"],
	["live", "eager"],
	["live", "lazy"]
])("rules on run.self with a level suffix — %s runtime, %s mode", (runtime, mode) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Make an instance with `mod` added and report what each of its four entries gives.
	 * @param {object} permissions - The permissions config.
	 * @returns {Promise<{run: string, runSelf: string, scope: string, scopeSelf: string}>} The outcomes.
	 */
	async function outcomes(permissions) {
		api = await slothlet({ base: BASE, runtime, mode, silent: true, permissions });
		await api.slothlet.api.add("mod", MOD);
		const seen = {
			run: await codeOf(() => api.mod.viaRun()),
			runSelf: await codeOf(() => api.mod.viaRunSelf()),
			scope: await codeOf(() => api.mod.viaScope()),
			scopeSelf: await codeOf(() => api.mod.viaScopeSelf())
		};
		await api.slothlet.shutdown();
		api = null;
		return seen;
	}

	it.each(LEVELS)("a deny on slothlet.context.run.self%s refuses run.self() and scope({ self: true }) alone", async (level) => {
		const seen = await outcomes({
			mode: "on",
			policy: "allow",
			rules: [{ caller: "mod.**", target: `slothlet.context.run.self${level}`, effect: "deny" }]
		});
		expect(seen).toEqual({ run: "ok", runSelf: D, scope: "ok", scopeSelf: D });
	});

	it("a :write deny on slothlet.context.run.self leaves its calls to the rules on run", async () => {
		const seen = await outcomes({
			mode: "on",
			policy: "allow",
			rules: [{ caller: "mod.**", target: "slothlet.context.run.self:write", effect: "deny" }]
		});
		expect(seen).toEqual({ run: "ok", runSelf: "ok", scope: "ok", scopeSelf: "ok" });
	});

	it.each(LEVELS)("under policy deny, an allow on slothlet.context.run.self%s allows run.self() and not run()", async (level) => {
		const seen = await outcomes({
			mode: "on",
			policy: "deny",
			rules: [
				{ caller: "mod.**", target: `slothlet.context.run.self${level}`, effect: "allow" },
				{ caller: "mod.**", target: "slothlet.context.scope", effect: "allow" }
			]
		});
		expect(seen).toEqual({ run: D, runSelf: "ok", scope: "ok", scopeSelf: "ok" });
	});

	it("under policy deny, an allow on scope alone allows scope() and not scope({ self: true })", async () => {
		const seen = await outcomes({
			mode: "on",
			policy: "deny",
			rules: [{ caller: "mod.**", target: "slothlet.context.scope", effect: "allow" }]
		});
		expect(seen).toEqual({ run: D, runSelf: D, scope: "ok", scopeSelf: D });
	});

	it("under policy deny, allows on run and scope allow every entry", async () => {
		const seen = await outcomes({
			mode: "on",
			policy: "deny",
			rules: [
				{ caller: "mod.**", target: "slothlet.context.run", effect: "allow" },
				{ caller: "mod.**", target: "slothlet.context.scope", effect: "allow" }
			]
		});
		expect(seen).toEqual({ run: "ok", runSelf: "ok", scope: "ok", scopeSelf: "ok" });
	});

	it("a deny on run refuses run.self() and scope({ self: true }) with it, and leaves a plain scope()", async () => {
		const seen = await outcomes({
			mode: "on",
			policy: "allow",
			rules: [{ caller: "mod.**", target: "slothlet.context.run", effect: "deny" }]
		});
		expect(seen).toEqual({ run: D, runSelf: D, scope: "ok", scopeSelf: D });
	});

	it("a deny on run with an allow on run.self refuses run() alone", async () => {
		const seen = await outcomes({
			mode: "on",
			policy: "allow",
			rules: [
				{ caller: "mod.**", target: "slothlet.context.run", effect: "deny" },
				{ caller: "mod.**", target: "slothlet.context.run.self:call", effect: "allow" }
			]
		});
		expect(seen).toEqual({ run: D, runSelf: "ok", scope: "ok", scopeSelf: "ok" });
	});

	it("a deny on scope refuses both scope() forms and leaves run.self()", async () => {
		const seen = await outcomes({
			mode: "on",
			policy: "allow",
			rules: [{ caller: "mod.**", target: "slothlet.context.scope:call", effect: "deny" }]
		});
		expect(seen).toEqual({ run: "ok", runSelf: "ok", scope: D, scopeSelf: D });
	});

	it.each([":call", ":access", ":full"])("under policy deny, an allow on **%s answers as one on ** does", async (level) => {
		const reference = await outcomes({ mode: "on", policy: "deny", rules: [{ caller: "mod.**", target: "**", effect: "allow" }] });
		const seen = await outcomes({ mode: "on", policy: "deny", rules: [{ caller: "mod.**", target: `**${level}`, effect: "allow" }] });
		expect(seen).toEqual(reference);
	});

	it("with the permission system off, a deny on run.self decides nothing", async () => {
		const seen = await outcomes({
			mode: "off",
			rules: [{ caller: "mod.**", target: "slothlet.context.run.self:call", effect: "deny" }]
		});
		expect(seen).toEqual({ run: "ok", runSelf: "ok", scope: "ok", scopeSelf: "ok" });
	});

	it("the host opens every entry whatever the rules on them", async () => {
		api = await slothlet({
			base: BASE,
			runtime,
			mode,
			silent: true,
			permissions: {
				mode: "on",
				rules: [
					{ caller: "**", target: "slothlet.context.run.self:call", effect: "deny" },
					{ caller: "**", target: "slothlet.context.run", effect: "deny" }
				]
			}
		});
		expect(await api.slothlet.context.run.self({}, (view) => typeof view)).toBe("object");
		expect(await api.slothlet.context.scope({ context: {}, self: true, fn: (view) => typeof view })).toBe("object");
		expect(await api.slothlet.context.scope({ context: {}, fn: (...got) => got.length })).toBe(0);
	});
});
