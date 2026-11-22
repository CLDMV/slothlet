/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-self-entries.test.vitest.mjs
 *	@Date: 2026-11-21T23:04:19-08:00 (1795331059)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T23:51:48-08:00 (1795333908)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The view `run.self()` / `scope({ self: true })` hands a callback opened by module code is that module's
 * own `self` binding, whichever runtime entry the module's file imported (`@cldmv/slothlet/runtime`, `/runtime/async`
 * or `/runtime/live`) when the instance's other files use another.
 *
 * Fixture (written at run time), added under `main`, `viaasync` and `vialive`: each file imports `self` from one entry
 * and reports whether the view it is handed is `===` its own `self`, through `run.self()` and through `scope()`.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-self-entries");
const BASE = path.join(ROOT, "api");

const ENTRIES = { main: "@cldmv/slothlet/runtime", viaasync: "@cldmv/slothlet/runtime/async", vialive: "@cldmv/slothlet/runtime/live" };

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(BASE, { recursive: true });
	writeFileSync(path.join(BASE, "math.mjs"), "export function add(a, b) {\n\treturn a + b;\n}\n");
	for (const [name, entry] of Object.entries(ENTRIES)) {
		mkdirSync(path.join(ROOT, name), { recursive: true });
		writeFileSync(
			path.join(ROOT, name, `${name}.mjs`),
			[
				`import { self } from ${JSON.stringify(entry)};`,
				"export function viaRunSelf() {",
				"\treturn self.slothlet.context.run.self({}, (view) => view === self);",
				"}",
				"export function viaScopeSelf() {",
				"\treturn self.slothlet.context.scope({ context: {}, self: true, fn: (view) => view === self });",
				"}",
				""
			].join("\n")
		);
	}
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe.each([
	["async", "eager"],
	["async", "lazy"],
	["live", "eager"],
	["live", "lazy"]
])("run.self view is the module's own self — %s runtime, %s mode", (runtime, mode) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	it.each(Object.keys(ENTRIES))("a module whose file imports the %s entry gets its own self", async (name) => {
		api = await slothlet({ base: BASE, runtime, mode, silent: true });
		for (const each of Object.keys(ENTRIES)) await api.slothlet.api.add(each, path.join(ROOT, each));
		expect(await api[name].viaRunSelf()).toBe(true);
		expect(await api[name].viaScopeSelf()).toBe(true);
	});

	it("each module of a mixed instance gets its own, whichever order they were added in", async () => {
		api = await slothlet({ base: BASE, runtime, mode, silent: true });
		for (const each of Object.keys(ENTRIES).reverse()) await api.slothlet.api.add(each, path.join(ROOT, each));
		expect([await api.viaasync.viaRunSelf(), await api.vialive.viaRunSelf(), await api.main.viaRunSelf()]).toEqual([true, true, true]);
	});
});
