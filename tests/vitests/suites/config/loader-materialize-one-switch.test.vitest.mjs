/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/config/loader-materialize-one-switch.test.vitest.mjs
 *	@Date: 2026-11-19T16:04:09-08:00 (1795133049)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:20-08:00 (1795869080)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `loader.materialize` is the one switch for background loading in v4. v3's `tracking` option
 * (`tracking: true` / `tracking: { materialization: true }`) did the same thing and is removed: passing it is refused
 * like any other key the v4 config does not have. With `loader.materialize` on, every lazy node loads in the background
 * through a single trigger (deferred through the instance clock) and `materialized:complete` fires; with it off,
 * nothing loads until it is used and the event never fires.
 * @module tests/vitests/suites/config/loader-materialize-one-switch
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;

/**
 * Wait (bounded) for an instance's background loading to finish.
 * @param {object} api - Slothlet api.
 * @returns {Promise<boolean>} True when everything loaded within the bound.
 */
function settles(api) {
	let timer;
	return Promise.race([
		api.slothlet.materialize.wait().then(() => true),
		new Promise((resolve) => {
			timer = setTimeout(() => resolve(false), 10000);
		})
	]).finally(() => clearTimeout(timer));
}

/**
 * A host clock whose `set` only queues the work, so the test decides when slothlet's deferred work runs.
 * @returns {{ clock: object, queue: Function[] }} The clock and its queue.
 */
function heldClock() {
	const queue = [];
	return {
		queue,
		clock: {
			set: (fn, _ms, ...args) => {
				queue.push(() => fn(...args));
				return queue.length;
			},
			clear: () => {}
		}
	};
}

/**
 * An importer that records every leaf URL it is asked for.
 * @returns {{ importer: Function, seen: string[] }} The importer and what it saw.
 */
function recordingImporter() {
	const seen = [];
	return {
		seen,
		importer: (moduleUrl) => {
			seen.push(moduleUrl);
			return import(moduleUrl);
		}
	};
}

describe.each(["async", "live"])("config > loader.materialize is the one materialization switch (%s)", (runtime) => {
	let api;
	let other;

	afterEach(async () => {
		if (api) await api.shutdown();
		if (other) await other.shutdown();
		api = null;
		other = null;
	});

	it("loader.materialize: true loads every lazy node in the background and fires materialized:complete once", async () => {
		const events = [];
		api = await slothlet({
			base: BASE,
			mode: "lazy",
			runtime,
			silent: true,
			loader: { materialize: true },
			lifecycle: { "materialized:complete": (data) => events.push(data) }
		});

		expect(await settles(api)).toBe(true);
		const stats = api.slothlet.materialize.get();
		expect(stats.total).toBeGreaterThan(0);
		expect(stats.remaining).toBe(0);
		expect(api.slothlet.materialize.complete).toBe(true);
		expect(events).toHaveLength(1);
		expect(events[0].total).toBe(stats.total);
		expect(typeof events[0].at).toBe("number");
		expect(typeof (await api.math.add(2, 3))).toBe("number");
	});

	it("a loader.materialize callback turns it on, and the event fires as well", async () => {
		const events = [];
		const calls = [];
		api = await slothlet({
			base: BASE,
			mode: "lazy",
			runtime,
			silent: true,
			loader: { materialize: (data) => calls.push(data) },
			lifecycle: { "materialized:complete": (data) => events.push(data) }
		});

		expect(await settles(api)).toBe(true);
		expect(calls).toHaveLength(1);
		expect(events).toHaveLength(1);
		expect(calls[0].total).toBe(events[0].total);
	});

	it("without loader.materialize nothing loads in the background and materialized:complete never fires", async () => {
		const events = [];
		api = await slothlet({
			base: BASE,
			mode: "lazy",
			runtime,
			silent: true,
			lifecycle: { "materialized:complete": (data) => events.push(data) }
		});

		await new Promise((resolve) => setTimeout(resolve, 200));
		const before = api.slothlet.materialize.get();
		expect(before.total).toBeGreaterThan(0);
		expect(before.remaining).toBeGreaterThan(0);
		expect(api.slothlet.materialize.complete).toBe(false);

		// Loading stays on demand: a node still loads when it is used, and the rest stay unloaded.
		expect(typeof (await api.math.add(2, 3))).toBe("number");
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(api.slothlet.materialize.get().remaining).toBeGreaterThan(0);
		expect(api.slothlet.materialize.complete).toBe(false);
		expect(events).toHaveLength(0);
	});

	it("loader.materialize: false is the same as leaving it out", async () => {
		const events = [];
		api = await slothlet({
			base: BASE,
			mode: "lazy",
			runtime,
			silent: true,
			loader: { materialize: false },
			lifecycle: { "materialized:complete": (data) => events.push(data) }
		});

		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(api.slothlet.materialize.get().remaining).toBeGreaterThan(0);
		expect(events).toHaveLength(0);
	});

	it("background loading has one trigger: it waits for the host clock and imports each leaf once", async () => {
		// Off: what loading the instance itself imports, with nothing loading in the background.
		const offImports = recordingImporter();
		const offClock = heldClock();
		other = await slothlet({
			base: BASE,
			mode: "lazy",
			runtime,
			silent: true,
			loader: { import: offImports.importer },
			clock: offClock.clock
		});
		const importedWithoutMaterialize = offImports.seen.length;

		// On, with the clock held: no background load may start before the clock moves.
		const onImports = recordingImporter();
		const onClock = heldClock();
		api = await slothlet({
			base: BASE,
			mode: "lazy",
			runtime,
			silent: true,
			loader: { materialize: true, import: onImports.importer },
			clock: onClock.clock
		});
		await new Promise((resolve) => setImmediate(resolve));
		expect(onImports.seen.length).toBe(importedWithoutMaterialize);
		expect(onClock.queue.length).toBeGreaterThan(0);
		expect(api.slothlet.materialize.get().remaining).toBeGreaterThan(0);

		// Let the clock run until everything has loaded.
		const deadline = Date.now() + 10000;
		while (!api.slothlet.materialize.complete && Date.now() < deadline) {
			const next = onClock.queue.shift();
			if (next) next();
			await new Promise((resolve) => setImmediate(resolve));
		}
		expect(api.slothlet.materialize.complete).toBe(true);

		// No second trigger loaded a node again: the background pass imports exactly what loading the same tree
		// eagerly imports, file for file.
		const eagerImports = recordingImporter();
		await other.shutdown();
		other = await slothlet({ base: BASE, mode: "eager", runtime, silent: true, loader: { import: eagerImports.importer } });
		const files = (seen) => seen.map((moduleUrl) => moduleUrl.split("?")[0]).sort();
		expect(onImports.seen.length).toBeGreaterThan(importedWithoutMaterialize);
		expect(files(onImports.seen)).toEqual(files(eagerImports.seen));
	});
});

describe("config > the v3 tracking option is gone", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["tracking: true", true],
		["tracking: false", false],
		["tracking: { materialization: true }", { materialization: true }],
		["tracking: { materialization: false }", { materialization: false }]
	])("refuses %s with INVALID_CONFIG_UNKNOWN_KEY", async (_label, tracking) => {
		const error = await slothlet({ base: BASE, mode: "lazy", silent: true, tracking }).catch((caught) => caught);
		expect(error?.code).toBe("INVALID_CONFIG_UNKNOWN_KEY");
		expect(error.details).toMatchObject({ where: "config", key: "tracking", path: ["tracking"] });
		expect(error.hint).toContain("@cldmv/slothlet-migrate");
	});

	it("leaves no tracking group in the config an instance reports", async () => {
		api = await slothlet({ base: BASE, mode: "lazy", silent: true, diagnostics: true, loader: { materialize: true } });
		const config = api.slothlet.diag.inspect().config;
		expect(config.tracking).toBeUndefined();
		expect(config.loader.materialize).toBe(true);
	});
});
