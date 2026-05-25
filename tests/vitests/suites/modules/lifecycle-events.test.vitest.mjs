/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/lifecycle-events.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 */

/**
 * @fileoverview Lifecycle event emission tests for the module discovery + mount feature.
 *
 * @description
 * Verifies that ModuleManager emits the five `modules:*` events per S8:
 *   - modules:discover-start
 *   - modules:discover-complete
 *   - modules:mount-start
 *   - modules:mount-complete (per-module)
 *   - modules:loaded (aggregate)
 *
 * Events are observed via `api.slothlet.lifecycle.on(eventName, handler)`.
 *
 * @module tests/vitests/suites/modules/lifecycle-events
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, "../../../../api_tests");
const FIX_NPM = path.join(FIXTURE_ROOT, "api_test_modules_npm");

/** @type {any} */ let api;
/** @type {Array<{event: string, payload: any}>} */ let events;

beforeEach(async () => {
	events = [];
	api = await slothlet({
		dir: TEST_DIRS.API_TEST,
		mode: "eager",
		runtime: "async",
		silent: true,
		diagnostics: true,
		api: { collision: { initial: "merge", api: "merge" } }
	});
	// Subscribe to all five module events.
	for (const ev of ["modules:discover-start", "modules:discover-complete", "modules:mount-start", "modules:mount-complete", "modules:loaded"]) {
		api.slothlet.lifecycle.on(ev, (payload) => {
			events.push({ event: ev, payload });
		});
	}
});

afterEach(async () => {
	if (api?.shutdown) await api.shutdown().catch(() => {});
	api = null;
	events = null;
});

function eventsOfType(name) {
	return events.filter((e) => e.event === name);
}

// ─── discover() events ──────────────────────────────────────────────────────

describe("modules:discover-* events", () => {
	it("emits discover-start before discover-complete on a discover() call", async () => {
		await api.slothlet.api.modules.discover({ scanRoot: FIX_NPM });
		const startIdx = events.findIndex((e) => e.event === "modules:discover-start");
		const completeIdx = events.findIndex((e) => e.event === "modules:discover-complete");
		expect(startIdx).toBeGreaterThanOrEqual(0);
		expect(completeIdx).toBeGreaterThan(startIdx);
	});

	it("discover-start payload includes scanRoot and options", async () => {
		await api.slothlet.api.modules.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		const [{ payload }] = eventsOfType("modules:discover-start");
		expect(payload.scanRoot).toBe(FIX_NPM);
		expect(payload.options.prefix).toBe("packrat-extension-");
	});

	it("discover-complete payload includes found[] and stale[]", async () => {
		await api.slothlet.api.modules.discover({ scanRoot: FIX_NPM });
		const [{ payload }] = eventsOfType("modules:discover-complete");
		expect(Array.isArray(payload.found)).toBe(true);
		expect(payload.found.length).toBe(3);
		expect(Array.isArray(payload.stale)).toBe(true);
		expect(payload.stale.length).toBe(0); // nothing mounted yet
	});
});

// ─── addModule() event sequence ─────────────────────────────────────────────

describe("modules:mount-* and modules:loaded events — addModule()", () => {
	it("emits mount-start → mount-complete → loaded for a single addModule call", async () => {
		const mm = api.slothlet.api.modules;
		await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		events.length = 0; // clear discover events
		await mm.addModule("packrat-extension-baz");

		const sequence = events.map((e) => e.event);
		expect(sequence).toEqual(["modules:mount-start", "modules:mount-complete", "modules:loaded"]);
	});

	it("mount-complete payload identifies the mounted module", async () => {
		const mm = api.slothlet.api.modules;
		await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		await mm.addModule("packrat-extension-baz");

		const [{ payload }] = eventsOfType("modules:mount-complete");
		expect(payload.name).toBe("packrat-extension-baz");
		expect(payload.version).toBe("0.5.0");
		expect(payload.mountPath).toBe("extensions.baz");
		expect(typeof payload.moduleID).toBe("string");
	});

	it("loaded payload contains a mounted[] array of length 1", async () => {
		const mm = api.slothlet.api.modules;
		await mm.discover({ scanRoot: FIX_NPM, prefix: "packrat-extension-" });
		await mm.addModule("packrat-extension-baz");

		const [{ payload }] = eventsOfType("modules:loaded");
		expect(payload.mounted.length).toBe(1);
		expect(payload.mounted[0].packageName).toBe("packrat-extension-baz");
	});
});

// ─── addModules() per-item events ───────────────────────────────────────────

describe("modules:mount-* and modules:loaded events — addModules()", () => {
	it("emits one mount-complete per mounted item plus one loaded at the end", async () => {
		const mm = api.slothlet.api.modules;
		await mm.discover({ scanRoot: FIX_NPM });
		events.length = 0;
		await mm.addModules(["@org/packrat-driver-foo", "@org/packrat-driver-bar"]);

		expect(eventsOfType("modules:mount-start").length).toBe(1);
		expect(eventsOfType("modules:mount-complete").length).toBe(2);
		expect(eventsOfType("modules:loaded").length).toBe(1);
	});

	it("mount-start payload includes the items array and options", async () => {
		const mm = api.slothlet.api.modules;
		await mm.discover({ scanRoot: FIX_NPM });
		events.length = 0;
		await mm.addModules(["@org/packrat-driver-foo"], { concurrency: 1 });

		const [{ payload }] = eventsOfType("modules:mount-start");
		expect(Array.isArray(payload.items)).toBe(true);
		expect(payload.items[0]).toBe("@org/packrat-driver-foo");
		expect(payload.options.concurrency).toBe(1);
	});

	it("loaded payload mounted[] reflects all successfully-mounted modules", async () => {
		const mm = api.slothlet.api.modules;
		await mm.discover({ scanRoot: FIX_NPM });
		await mm.addModules(["@org/packrat-driver-foo", "@org/packrat-driver-bar", "packrat-extension-baz"]);

		const [{ payload }] = eventsOfType("modules:loaded");
		expect(payload.mounted.length).toBe(3);
	});
});

// ─── addDiscovered() chains all events ──────────────────────────────────────

describe("modules:* events — addDiscovered() chain", () => {
	it("emits the full discover + mount sequence in one addDiscovered call", async () => {
		await api.slothlet.api.modules.addDiscovered({ scanRoot: FIX_NPM });

		// discover phase
		expect(eventsOfType("modules:discover-start").length).toBe(1);
		expect(eventsOfType("modules:discover-complete").length).toBe(1);
		// mount phase
		expect(eventsOfType("modules:mount-start").length).toBe(1);
		expect(eventsOfType("modules:mount-complete").length).toBe(3);
		expect(eventsOfType("modules:loaded").length).toBe(1);
	});

	it("ordering: discover-start < discover-complete < mount-start < mount-complete < loaded", async () => {
		await api.slothlet.api.modules.addDiscovered({ scanRoot: FIX_NPM });

		const order = events.map((e) => e.event);
		const idxDiscoverStart = order.indexOf("modules:discover-start");
		const idxDiscoverComplete = order.indexOf("modules:discover-complete");
		const idxMountStart = order.indexOf("modules:mount-start");
		const idxFirstMountComplete = order.indexOf("modules:mount-complete");
		const idxLoaded = order.lastIndexOf("modules:loaded");

		expect(idxDiscoverStart).toBeLessThan(idxDiscoverComplete);
		expect(idxDiscoverComplete).toBeLessThan(idxMountStart);
		expect(idxMountStart).toBeLessThan(idxFirstMountComplete);
		expect(idxFirstMountComplete).toBeLessThan(idxLoaded);
	});
});
