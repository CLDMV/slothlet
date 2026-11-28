/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/helpers/instance-imports-shared-readers.test.vitest.mjs
 *	@Date: 2026-11-25T01:27:24-08:00 (1795598844)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:49-08:00 (1795869109)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The readers on the object the slothlet copies of a process share (see `sharedState` in
 * `src/lib/helpers/instance-imports.mjs`): an instance's import graph is only ever added to, and read through a
 * read-only view that hands out copies; the record of loaded scripts answers nothing for a key it never saw.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import slothlet from "@cldmv/slothlet";

const STATE = Symbol.for("@cldmv/slothlet.instanceImports");
const ID = `graph-reader-${process.pid}`;
const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_self_closed/api");

// An instance up once makes the shared object, as slothlet does in any process that runs one.
beforeAll(async () => {
	const api = await slothlet({ base: BASE, silent: true });
	await api.shutdown();
});

describe("instance-imports > the shared object's readers", () => {
	let state;
	beforeAll(() => {
		state = globalThis[STATE];
	});

	it("is fixed on the global object and frozen", () => {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, STATE);
		expect(descriptor.writable).toBe(false);
		expect(descriptor.configurable).toBe(false);
		expect(Object.isFrozen(state)).toBe(true);
	});

	it("records nothing for a call that does not name an instance, an importer and a list of files", () => {
		state.recordImports(undefined, "/app/a.mjs", ["/app/b.mjs"]);
		state.recordImports(`${ID}-none`, 1, ["/app/b.mjs"]);
		state.recordImports(`${ID}-none`, "/app/a.mjs", "/app/b.mjs");
		expect(state.imports.of(`${ID}-none`)).toBe(null);
		expect(state.imports.of(undefined)).toBe(null);
	});

	it("counts no edge for a list holding no file name", () => {
		state.recordImports(`${ID}-empty`, "/app/a.mjs", [1, null]);
		const view = state.imports.of(`${ID}-empty`);
		expect(view.edges).toBe(0);
		expect(view.size).toBe(0);
	});

	it("reads an instance's graph through one read-only view that hands out copies", () => {
		state.recordImports(ID, "C:\\app\\a.mjs", ["/app/b.mjs", 42, "/app/b.mjs", "/app/c.mjs"]);
		const view = state.imports.of(ID);
		expect(state.imports.of(ID)).toBe(view);
		expect(Object.isFrozen(view)).toBe(true);
		expect(view.edges).toBe(2);
		expect(view.size).toBe(2);
		expect(view.has("/app/b.mjs")).toBe(true);
		expect(view.has("/app/a.mjs")).toBe(false);
		const importers = view.get("/app/b.mjs");
		expect([...importers]).toEqual(["C:/app/a.mjs"]);
		importers.clear();
		expect([...view.get("/app/b.mjs")]).toEqual(["C:/app/a.mjs"]);
		expect(view.get("/app/missing.mjs")).toBe(undefined);
		expect([...view.keys()]).toEqual(["/app/b.mjs", "/app/c.mjs"]);
		expect([...view]).toEqual([
			["/app/b.mjs", ["C:/app/a.mjs"]],
			["/app/c.mjs", ["C:/app/a.mjs"]]
		]);
		// A further importer is added; the same one again counts no new edge.
		state.recordImports(ID, "/app/d.mjs", ["/app/b.mjs"]);
		state.recordImports(ID, "/app/d.mjs", ["/app/b.mjs"]);
		expect(view.edges).toBe(3);
		expect([...view.get("/app/b.mjs")]).toEqual(["C:/app/a.mjs", "/app/d.mjs"]);
	});

	it("answers nothing about a script key it never saw", () => {
		const key = `/never/loaded-${process.pid}.mjs`;
		expect(state.scripts.lookup(key, "hash")).toEqual({ known: false, has: false, helper: false, stamp: null });
		expect(state.scripts.lookup(key, undefined)).toEqual({ known: false, has: false, helper: false, stamp: null });
		expect(state.scripts.hashes(key)).toEqual([]);
		expect(state.scripts.text(key, "hash")).toBe(undefined);
		expect(state.scripts.text(key, null)).toBe(undefined);
		expect(state.scripts.packageImporters(key)).toEqual([]);
	});
});
