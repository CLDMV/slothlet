/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/lazy/lazy-materialize-after-reload-no-als.test.vitest.mjs
 *	@Date: 2026-11-22T12:00:00-08:00 (1795377600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:00-08:00 (1795869120)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview On a host with no AsyncLocalStorage (a browser), where a full reload builds its new copy on the
 * instance's own set, a lazy instance counts its nodes after the reload as a fresh instance does and settles once they
 * have loaded. A reload that fails leaves the counts as they were. Run with `AsyncLocalStorage` taken away from
 * slothlet's platform layer, on the live runtime.
 *
 * @description
 * Fixture (written at run time): four folders, `calls/`, `other/`, `more/` and `admin/`, each with one file exporting
 * `copyOf()`; `broken/broken.mjs` throws while it loads when `globalThis[BREAK]` is set, so a test can fail a reload.
 * @module tests/vitests/suites/lazy/lazy-materialize-after-reload-no-als
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";

vi.mock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), AsyncLocalStorage: null }));

const ROOT = path.join(process.cwd(), "tmp", "lazy-materialize-after-reload-no-als");
const BASE = path.join(ROOT, "api");
const BROKEN = path.join(ROOT, "broken");
const NAMES = ["calls", "other", "more", "admin"];
const BREAK = Symbol.for("slothlet.test.lazy-materialize-after-reload-no-als.break");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const name of NAMES) {
		mkdirSync(path.join(BASE, name), { recursive: true });
		writeFileSync(path.join(BASE, name, `${name}.mjs`), `export function copyOf() {\n\treturn "${name}";\n}\n`);
	}
	mkdirSync(BROKEN, { recursive: true });
	writeFileSync(
		path.join(BROKEN, "broken.mjs"),
		[
			'if (globalThis[Symbol.for("slothlet.test.lazy-materialize-after-reload-no-als.break")]) throw new Error("broken");',
			"export function ok() {",
			"\treturn true;",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Whether a promise settles within a time limit.
 * @param {Promise<*>} promise - The promise.
 * @param {number} ms - The limit.
 * @returns {Promise<string>} "resolved", "rejected" or "pending".
 */
const settlesWithin = (promise, ms) =>
	Promise.race([
		promise.then(
			() => "resolved",
			() => "rejected"
		),
		new Promise((resolve) => setTimeout(() => resolve("pending"), ms))
	]);

describe("materialization counts after a full reload with no AsyncLocalStorage > lazy / live", () => {
	let api;
	let fresh;

	afterEach(async () => {
		delete globalThis[BREAK];
		await api?.slothlet.shutdown();
		await fresh?.slothlet.shutdown();
		api = null;
		fresh = null;
	});

	it("counts the reloaded tree as a fresh instance counts the same folder, and settles once it has loaded", async () => {
		fresh = await slothlet({ base: BASE, runtime: "live", mode: "lazy", silent: true });
		api = await slothlet({ base: BASE, runtime: "live", mode: "lazy", silent: true });
		const held = api.other;
		await api.slothlet.reload();
		expect(api.slothlet.materialize.get()).toEqual(fresh.slothlet.materialize.get());
		const before = api.slothlet.materialize.get();
		expect(await held.copyOf()).toBe("other");
		expect(api.slothlet.materialize.get()).toEqual(before);
		for (const name of NAMES) expect(await api[name].copyOf()).toBe(name);
		expect(api.slothlet.materialize.get()).toMatchObject({ total: NAMES.length, remaining: 0 });
		expect(api.slothlet.materialize.complete).toBe(true);
		expect(await settlesWithin(api.slothlet.materialize.wait(), 2000)).toBe("resolved");
	});

	it("leaves the counts as they were when the reload fails", async () => {
		api = await slothlet({ base: BASE, runtime: "live", mode: "lazy", silent: true });
		await api.slothlet.api.add("broken", BROKEN);
		await api.calls.copyOf();
		const before = api.slothlet.materialize.get();
		globalThis[BREAK] = true;
		await expect(api.slothlet.reload()).rejects.toThrow();
		delete globalThis[BREAK];
		expect(api.slothlet.materialize.get()).toEqual(before);
		for (const name of NAMES) await api[name].copyOf();
		await api.broken.ok();
		expect(api.slothlet.materialize.get()).toMatchObject({ remaining: 0 });
		expect(await settlesWithin(api.slothlet.materialize.wait(), 2000)).toBe("resolved");
	});
});
