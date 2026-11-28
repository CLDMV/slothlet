/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/lazy/lazy-materialize-after-reload.test.vitest.mjs
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
 * @fileoverview A lazy instance counts its nodes after a full `reload()` as a fresh instance of the same folder does, and
 * settles once they have loaded: `materialize.get()` reports the new tree's nodes only, `complete` turns true and
 * `materialize.wait()` resolves.
 *
 * @description
 * Fixture (written at run time): four folders, `calls/`, `other/`, `more/` and `admin/`, each with one file exporting
 * `copyOf()`. The reference is a fresh lazy instance of the same folder. A node held from before the reload, and a node
 * a `run()` opened before the reload loads after it, belong to the tree the reload replaced: loading them leaves the
 * reloaded instance's counts alone.
 * @module tests/vitests/suites/lazy/lazy-materialize-after-reload
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "lazy-materialize-after-reload");
const BASE = path.join(ROOT, "api");
const NAMES = ["calls", "other", "more", "admin"];

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const name of NAMES) {
		mkdirSync(path.join(BASE, name), { recursive: true });
		writeFileSync(path.join(BASE, name, `${name}.mjs`), `export function copyOf() {\n\treturn "${name}";\n}\n`);
	}
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

const configs = ["async", "live"].map((runtime) => ({ runtime, name: runtime }));

describe.each(configs)("materialization counts after a full reload > lazy / $name", ({ runtime }) => {
	let api;
	let fresh;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		await fresh?.slothlet.shutdown();
		api = null;
		fresh = null;
	});

	it("counts the reloaded tree as a fresh instance counts the same folder", async () => {
		fresh = await slothlet({ base: BASE, runtime, mode: "lazy", silent: true });
		api = await slothlet({ base: BASE, runtime, mode: "lazy", silent: true });
		await api.slothlet.reload();
		expect(api.slothlet.materialize.get()).toEqual(fresh.slothlet.materialize.get());
		expect(api.slothlet.materialize.get()).toMatchObject({ total: NAMES.length, remaining: NAMES.length });
	});

	it("settles once every node of the reloaded tree has loaded", async () => {
		api = await slothlet({ base: BASE, runtime, mode: "lazy", silent: true });
		await api.slothlet.reload();
		const waiting = api.slothlet.materialize.wait();
		for (const name of NAMES) expect(await api[name].copyOf()).toBe(name);
		expect(api.slothlet.materialize.get()).toMatchObject({ total: NAMES.length, materialized: NAMES.length, remaining: 0 });
		expect(api.slothlet.materialize.complete).toBe(true);
		expect(await settlesWithin(waiting, 2000)).toBe("resolved");
		expect(await settlesWithin(api.slothlet.materialize.wait(), 2000)).toBe("resolved");
	});

	it("settles after a reload of an instance that had loaded some nodes first", async () => {
		api = await slothlet({ base: BASE, runtime, mode: "lazy", silent: true });
		await api.calls.copyOf();
		await api.other.copyOf();
		await api.slothlet.reload();
		expect(api.slothlet.materialize.get()).toMatchObject({ total: NAMES.length, remaining: NAMES.length });
		for (const name of NAMES) await api[name].copyOf();
		expect(api.slothlet.materialize.complete).toBe(true);
		expect(await settlesWithin(api.slothlet.materialize.wait(), 2000)).toBe("resolved");
	});

	it("leaves the reloaded instance's counts alone when a node held from before the reload loads", async () => {
		api = await slothlet({ base: BASE, runtime, mode: "lazy", silent: true });
		const held = api.other;
		await api.slothlet.reload();
		const before = api.slothlet.materialize.get();
		expect(await held.copyOf()).toBe("other");
		expect(api.slothlet.materialize.get()).toEqual(before);
		for (const name of NAMES) await api[name].copyOf();
		expect(api.slothlet.materialize.get()).toMatchObject({ total: NAMES.length, remaining: 0 });
		expect(await settlesWithin(api.slothlet.materialize.wait(), 2000)).toBe("resolved");
	});

	it("leaves the reloaded instance's counts alone when a run opened before the reload loads a node", async () => {
		api = await slothlet({ base: BASE, runtime, mode: "lazy", silent: true });
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		let entered;
		const inRun = new Promise((resolve) => (entered = resolve));
		const run = api.slothlet.context.run({ user: "kept" }, async () => {
			entered();
			await gate;
			return api.more.copyOf();
		});
		await inRun;
		await api.slothlet.reload();
		const before = api.slothlet.materialize.get();
		release();
		expect(await run).toBe("more");
		expect(api.slothlet.materialize.get()).toEqual(before);
		for (const name of NAMES) await api[name].copyOf();
		expect(api.slothlet.materialize.get()).toMatchObject({ total: NAMES.length, remaining: 0 });
		expect(await settlesWithin(api.slothlet.materialize.wait(), 2000)).toBe("resolved");
	});
});
