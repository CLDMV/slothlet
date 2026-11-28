/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/host-flow-module-code.test.vitest.mjs
 *	@Date: 2026-11-17T07:02:00-08:00 (1794927720)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:15-08:00 (1795869135)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's code the host runs inside a `run()` / `scope()` it opened is held to that module.
 *
 * @description
 * Code a module hands out runs as its definer, also when the host runs it inside a flow it opened with
 * `api.slothlet.context.run()` or `scope()`: the flow names no module, but the code is the module's. Such code may
 * neither use the framework's namespace as the host (`self.slothlet.permissions.control.mode("off")`, which only the
 * host may call) nor write a node of the api the module does not own. Three ways module code comes to run in a host
 * flow are covered: a function the module left on `globalThis` that the host calls inside `run()`, the same inside
 * `scope()`, and a timer of the module's own whose async context the module copied from a timer the host made inside
 * `run()` (Node keeps a timer's async context on the timer, under a symbol any code holding it can list).
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "host-flow-module-code");

/**
 * Write a fixture file, creating its folder.
 * @param {string} file - Path below the fixture root.
 * @param {string[]} lines - File contents, one line each.
 * @returns {void}
 */
function write(file, lines) {
	const target = path.join(ROOT, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/secret/secret.mjs", ["export function read() {", '\treturn "secret";', "}"]);
	write("planter/planter.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"const codeOf = (error) => error?.code ?? String(error);",
		"// What the module's code tries once it runs in a flow the host opened.",
		"function attempt(label) {",
		"\tconst out = {};",
		"\ttry {",
		'\t\tself.slothlet.permissions.control.mode("off");',
		'\t\tout.control = "ok";',
		"\t} catch (error) {",
		"\t\tout.control = codeOf(error);",
		"\t}",
		"\ttry {",
		'\t\tself.secret["planted_" + label] = () => "planted";',
		'\t\tout.write = "ok";',
		"\t} catch (error) {",
		"\t\tout.write = codeOf(error);",
		"\t}",
		"\treturn out;",
		"}",
		"export function plant() {",
		"\tglobalThis.__slothletHostFlowPlanted = attempt;",
		"\treturn true;",
		"}",
		"let hostTimer = null;",
		"export function keep(timer) {",
		"\thostTimer = timer;",
		"\treturn true;",
		"}",
		"// A timer of the module's own, given the async context Node keeps on the host's timer.",
		"export function adopt() {",
		"\treturn new Promise((resolve) => {",
		'\t\tconst mine = setTimeout(() => resolve(attempt("timer")), 5);',
		"\t\tfor (const key of Object.getOwnPropertySymbols(hostTimer)) {",
		"\t\t\tif (/store|frame|context/i.test(String(key))) mine[key] = hostTimer[key];",
		"\t\t}",
		"\t});",
		"}"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe("Permissions > module code in a flow the host opened", () => {
	let api;

	afterEach(async () => {
		delete globalThis.__slothletHostFlowPlanted;
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * An instance with the permission system on, and the planting module added.
	 * @returns {Promise<object>} The api.
	 */
	async function make() {
		api = await slothlet({
			base: path.join(ROOT, "api"),
			silent: true,
			permissions: { mode: "on", rules: [{ caller: "planter.**", target: "secret.**", effect: "deny" }] }
		});
		await api.slothlet.api.add("planter", path.join(ROOT, "planter"), { id: "planter" });
		return api;
	}

	// As module code the host runs outside any flow is refused: the write is outside what the module owns.
	const REFUSED = { control: "PERMISSION_DENIED", write: "CONTEXT_NOT_ACTIVE_SELF" };

	it("is refused outside any flow (reference)", async () => {
		await make();
		await api.planter.plant();
		const result = globalThis.__slothletHostFlowPlanted("bare");
		expect(result).toEqual(REFUSED);
		expect(api.slothlet.permissions.control.mode()).toBe("on");
		expect(api.secret.planted_bare).toBeUndefined();
	});

	it("a function it left on globalThis, run by the host inside run(), is refused", async () => {
		await make();
		await api.planter.plant();
		const result = await api.slothlet.context.run({ user: "root" }, () => globalThis.__slothletHostFlowPlanted("run"));
		expect(result).toEqual(REFUSED);
		expect(api.slothlet.permissions.control.mode()).toBe("on");
		expect(api.secret.planted_run).toBeUndefined();
	});

	it("a function it left on globalThis, run by the host inside scope(), is refused", async () => {
		await make();
		await api.planter.plant();
		const result = await api.slothlet.context.scope({ context: { user: "root" }, fn: () => globalThis.__slothletHostFlowPlanted("scope") });
		expect(result).toEqual(REFUSED);
		expect(api.slothlet.permissions.control.mode()).toBe("on");
		expect(api.secret.planted_scope).toBeUndefined();
	});

	it("its own timer, given the async context of a timer the host made inside run(), is refused", async () => {
		await make();
		let timer;
		await api.slothlet.context.run({ user: "root" }, () => {
			timer = setTimeout(() => {}, 1000);
			return api.planter.keep(timer);
		});
		// The host's timer stays live until the module has adopted it: newer Node releases drop a cleared timer's async
		// context, which would leave the module nothing to adopt.
		try {
			const result = await api.planter.adopt();
			// The planter's code now counts as its own module, so the write is refused as not owned.
			expect(result).toEqual({ control: "PERMISSION_DENIED", write: "LOOSE_SET_NOT_OWNED" });
		} finally {
			clearTimeout(timer);
		}
		expect(api.slothlet.permissions.control.mode()).toBe("on");
		expect(api.secret.planted_timer).toBeUndefined();
	});

	it("the host's own code inside run() still uses the api as the host", async () => {
		await make();
		await api.slothlet.context.run({ user: "root" }, () => {
			api.secret.hostOwn = () => "host";
		});
		expect(api.secret.hostOwn()).toBe("host");
		expect(api.slothlet.permissions.control.mode()).toBe("on");
	});
});
