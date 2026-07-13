/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/impl-diagnostic-events.test.vitest.mjs
 *	@Date: 2026-07-10T12:00:00-07:00 (1783710000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10T12:00:00-07:00 (1783710000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for the `impl:warning` / `impl:error` diagnostic lifecycle events and the
 * construction-time `lifecycle` config option (#148).
 *
 * @description
 * Verifies that non-throwing diagnostics — warnings and handled-but-not-thrown runtime errors —
 * emit additive `impl:warning` / `impl:error` lifecycle events, both at runtime and during cold-start
 * initialization. Also verifies the new `lifecycle` config option, which registers subscribers on the
 * lifecycle emitter BEFORE the api builds so init-time events are observable, and that it validates its
 * shape (invalid config still THROWS rather than emitting).
 *
 * @module tests/vitests/suites/lifecycle/impl-diagnostic-events
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE_TMP = join(process.cwd(), "tmp", `impl-diagnostic-events-${process.pid}`);

// Keep the console clean during the run via the static `suppressConsole` flag: these tests don't pass
// `silent`, so the init-time warning sites would otherwise print. Console suppression — whether via
// `silent` or this flag — never affects event emission; that is the whole point of the feature.
// (The `silent: true` gating of those console warnings is covered by its own describe block below.)
beforeEach(() => {
	SlothletWarning.suppressConsole = true;
	SlothletWarning.clearCaptured();
});
afterEach(() => {
	SlothletWarning.suppressConsole = false;
});

// ─── Runtime diagnostics (eager + lazy) ─────────────────────────────────────

describe.each([["eager"], ["lazy"]])("impl:warning / impl:error — runtime (%s mode)", (mode) => {
	/** @type {any} */ let api;
	/** @type {string} */ let dir;
	/** @type {Array<{event: string, payload: any}>} */ let events;

	beforeEach(async () => {
		events = [];
		dir = join(BASE_TMP, `${mode}-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "base.mjs"), `export function base() { return "base"; }\n`);
		api = await slothlet({
			base: dir,
			mode,
			runtime: "async",
			api: { mutations: { add: true, remove: true, reload: true }, collision: { initial: "merge", api: "merge" } }
		});
		for (const ev of ["impl:warning", "impl:error"]) {
			api.slothlet.lifecycle.on(ev, (payload) => events.push({ event: ev, payload }));
		}
	});

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown().catch(() => {});
		api = null;
		rmSync(dir, { recursive: true, force: true });
	});

	function warningsOfCode(code) {
		return events.filter((e) => e.event === "impl:warning" && e.payload.code === code).map((e) => e.payload);
	}

	it("fires impl:warning for a dropped unnamed default at the root", async () => {
		// An anonymous / `default`-keyed default has no name to key onto at root: it is dropped (#136).
		await api.slothlet.api.add("", { exports: { default: () => "x" } });

		const [payload] = warningsOfCode("WARN_SYNTHETIC_ROOT_UNNAMED");
		expect(payload).toBeDefined();
		expect(payload.apiPath).toBe("");
		expect(payload.code).toBe("WARN_SYNTHETIC_ROOT_UNNAMED");
		expect(typeof payload.message).toBe("string");
		expect(payload.message.length).toBeGreaterThan(0);
		expect(payload.source).toBe("addApi");
		expect(payload.context).toEqual({});
	});

	it("fires impl:warning when a root default's name collides with a named export", async () => {
		await api.slothlet.api.add("", {
			exports: {
				default: function greet() {
					return "default";
				},
				greet: () => "named"
			}
		});
		// Named export wins; the diagnostic is still emitted.
		expect(await api.greet()).toBe("named");

		const [payload] = warningsOfCode("WARN_SYNTHETIC_ROOT_COLLISION");
		expect(payload).toBeDefined();
		expect(payload.apiPath).toBe("");
		expect(payload.source).toBe("addApi");
		expect(payload.context).toEqual({ name: "greet" });
		expect(typeof payload.message).toBe("string");
	});

	it("fires impl:warning for a no-op root add that contributes no keys", async () => {
		await api.slothlet.api.add("", { exports: {} });

		const [payload] = warningsOfCode("WARN_SYNTHETIC_ROOT_EMPTY");
		expect(payload).toBeDefined();
		expect(payload.apiPath).toBe("");
		expect(payload.source).toBe("addApi");
		expect(payload.context).toEqual({ apiPath: "(root)" });
		expect(typeof payload.message).toBe("string");
	});

	it("fires impl:warning even under silent: true (console suppressed, event still delivered)", async () => {
		if (api?.shutdown) await api.shutdown().catch(() => {});
		const silentEvents = [];
		api = await slothlet({
			base: dir,
			mode,
			runtime: "async",
			silent: true,
			api: { mutations: { add: true, remove: true, reload: true } }
		});
		api.slothlet.lifecycle.on("impl:warning", (payload) => silentEvents.push(payload));

		await api.slothlet.api.add("", { exports: {} });

		const empty = silentEvents.find((p) => p.code === "WARN_SYNTHETIC_ROOT_EMPTY");
		expect(empty).toBeDefined();
		expect(empty.source).toBe("addApi");
	});

	it("fires impl:warning for a root default/name collision under silent: true (console gated off, event delivered)", async () => {
		// Same collision as the non-silent test above, but with silent: true. The console-warning
		// site (this.slothlet && !silent) is gated off — exercising its silent-suppressed arm — while
		// the additive impl:warning event still fires regardless of silent.
		if (api?.shutdown) await api.shutdown().catch(() => {});
		const silentEvents = [];
		api = await slothlet({
			base: dir,
			mode,
			runtime: "async",
			silent: true,
			api: { mutations: { add: true, remove: true, reload: true } }
		});
		api.slothlet.lifecycle.on("impl:warning", (payload) => silentEvents.push(payload));

		await api.slothlet.api.add("", {
			exports: {
				default: function greet() {
					return "default";
				},
				greet: () => "named"
			}
		});
		// Named export still wins even with the console warning suppressed.
		expect(await api.greet()).toBe("named");

		const collision = silentEvents.find((p) => p.code === "WARN_SYNTHETIC_ROOT_COLLISION");
		expect(collision).toBeDefined();
		expect(collision.apiPath).toBe("");
		expect(collision.source).toBe("addApi");
		expect(collision.context).toEqual({ name: "greet" });
	});

	it("fires impl:error for a handled hot-reload merge-primitives failure (not thrown)", async () => {
		// Existing value is a primitive; a merge-add of a module (object) over it cannot merge, so the
		// mutation is rejected and the command continues without throwing — a handled runtime error.
		api.primitiveKey = 42;
		await api.slothlet.api.add("primitiveKey", TEST_DIRS.API_TEST_MIXED, {
			collisionMode: "merge",
			moduleID: "prim-merge"
		});

		const errors = events.filter((e) => e.event === "impl:error").map((e) => e.payload);
		expect(errors.length).toBeGreaterThanOrEqual(1);
		const [payload] = errors;
		expect(payload.code).toBe("WARNING_HOT_RELOAD_MERGE_PRIMITIVES");
		expect(payload.apiPath).toBe("primitiveKey");
		expect(payload.source).toBe("addApi");
		expect(payload.error).toBeInstanceOf(Error);
		expect(payload.error.code).toBe("WARNING_HOT_RELOAD_MERGE_PRIMITIVES");
		expect(typeof payload.message).toBe("string");
		// The existing primitive is preserved (mutation rejected).
		expect(api.primitiveKey).toBe(42);
	});
});

// ─── Construction-time `lifecycle` config option ────────────────────────────

describe("lifecycle config option — construction-time subscription", () => {
	it("catches an INIT-time impl:warning emitted during buildAPI", async () => {
		const initEvents = [];
		// The multi-root-fn fixture exports two root-level default functions → a non-throwing
		// WARNING_MULTIPLE_ROOT_CONTRIBUTORS during cold-start buildAPI.
		const api = await slothlet({
			base: TEST_DIRS.API_TEST_MULTI_ROOT_FN,
			mode: "eager",
			silent: true,
			lifecycle: {
				"impl:warning": (payload) => initEvents.push(payload)
			}
		});
		try {
			const init = initEvents.find((p) => p.code === "WARNING_MULTIPLE_ROOT_CONTRIBUTORS");
			expect(init).toBeDefined();
			expect(init.source).toBe("buildAPI");
			expect(typeof init.message).toBe("string");
		} finally {
			await api.shutdown().catch(() => {});
		}
	});

	it("catches the INIT-time reserved-property impl:warning during buildAPI", async () => {
		const initEvents = [];
		// The reserved-name fixture contributes a `slothlet` key → non-throwing
		// WARNING_RESERVED_PROPERTY_CONFLICT during buildFinalAPI.
		const api = await slothlet({
			base: TEST_DIRS.API_TEST_RESERVED_NAME,
			mode: "eager",
			silent: true,
			lifecycle: {
				"impl:warning": (payload) => initEvents.push(payload)
			}
		});
		try {
			const reserved = initEvents.find((p) => p.code === "WARNING_RESERVED_PROPERTY_CONFLICT");
			expect(reserved).toBeDefined();
			expect(reserved.source).toBe("buildAPI");
			expect(reserved.context).toEqual({ properties: "slothlet" });
		} finally {
			await api.shutdown().catch(() => {});
		}
	});

	it("also receives runtime events (same subscriber persists after build)", async () => {
		const dir = join(BASE_TMP, `cfg-runtime-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "base.mjs"), `export function base() { return "base"; }\n`);
		const seen = [];
		const api = await slothlet({
			base: dir,
			mode: "eager",
			silent: true,
			api: { mutations: { add: true, remove: true, reload: true } },
			lifecycle: {
				// Array form: multiple handlers for one event.
				"impl:warning": [(p) => seen.push(["a", p.code]), (p) => seen.push(["b", p.code])]
			}
		});
		try {
			await api.slothlet.api.add("", { exports: {} });
			const empties = seen.filter(([, code]) => code === "WARN_SYNTHETIC_ROOT_EMPTY");
			// Both array handlers fire for the runtime event.
			expect(empties.map(([tag]) => tag).sort()).toEqual(["a", "b"]);
		} finally {
			await api.shutdown().catch(() => {});
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("throws (does not emit) for an invalid lifecycle config shape", async () => {
		// A non-object value.
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: "nope" })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		// An array (not a plain map).
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: [] })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		// A non-function handler value.
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: { "impl:warning": 123 } })).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});
		// A non-function inside an array of handlers.
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: { "impl:error": [() => {}, null] } })).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});
	});

	it("throws (does not silently accept) a class instance in place of a plain object", async () => {
		// A class instance (e.g. `new Date()`) is `typeof === "object"` and not an array, so the
		// loose check alone would let it through — often with zero enumerable own properties, so
		// the per-entry handler-validation loop below never runs and the malformed config is
		// silently accepted instead of rejected.
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: new Date() })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: new Map() })).rejects.toMatchObject({ code: "INVALID_CONFIG" });

		class CustomLifecycle {}
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: new CustomLifecycle() })).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});

		// Sanity check: a null-prototype object is still accepted as a valid plain-object map.
		const nullProto = Object.create(null);
		nullProto["impl:warning"] = () => {};
		const api = await slothlet({ base: TEST_DIRS.API_TEST, lifecycle: nullProto });
		await api.shutdown().catch(() => {});
	});

	it("throws for a non-plain object whose constructor has no resolvable name", async () => {
		// The rejection message reports the offending constructor name (`X instance`) when there is
		// one, but must fall back to a generic "non-plain object" label when `constructor?.name` is
		// falsy. Both of these values have a prototype that is neither null nor Object.prototype (so
		// they are correctly rejected as non-plain), yet expose no usable constructor name:

		// (a) An object whose prototype chain roots in a null-prototype object — walking the chain
		//     finds no `constructor`, so `constructor?.name` is undefined.
		const noCtor = Object.create(Object.create(null));
		noCtor["impl:warning"] = () => {};
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: noCtor })).rejects.toMatchObject({ code: "INVALID_CONFIG" });

		// (b) An instance of an anonymous class expression — its constructor exists but `name` is "".
		const anon = new (class {})();
		await expect(slothlet({ base: TEST_DIRS.API_TEST, lifecycle: anon })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
	});

	it("init-time invalid config (missing base) still THROWS — not an event", async () => {
		await expect(slothlet({})).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_MISSING" });
	});
});

// ─── silent gates init-time console warnings (but never events) ──────────────
// #196 review follow-up: the init-time warning sites (WARNING_RESERVED_PROPERTY_CONFLICT,
// WARNING_MULTIPLE_ROOT_CONTRIBUTORS, WARN_DIRECTORY_EMPTY) now honor `silent` like every other
// SlothletWarning site, so `silent: true` suppresses their console output — while the additive
// impl:warning EVENT still fires regardless of `silent`.
describe("silent gates init-time console warnings, not events", () => {
	it("silent:true suppresses the reserved-property console warning; the impl:warning event still fires", async () => {
		const events = [];
		const api = await slothlet({
			base: TEST_DIRS.API_TEST_RESERVED_NAME,
			mode: "eager",
			silent: true,
			lifecycle: { "impl:warning": (payload) => events.push(payload) }
		});
		// Console warning is silent-gated → never constructed → not captured.
		expect(SlothletWarning.captured.some((w) => w.code === "WARNING_RESERVED_PROPERTY_CONFLICT")).toBe(false);
		// The event is additive → fires even under silent.
		expect(events.some((p) => p.code === "WARNING_RESERVED_PROPERTY_CONFLICT")).toBe(true);
		await api.shutdown().catch(() => {});
	});

	it("without silent, the reserved-property console warning IS emitted (control)", async () => {
		const api = await slothlet({ base: TEST_DIRS.API_TEST_RESERVED_NAME, mode: "eager" });
		expect(SlothletWarning.captured.some((w) => w.code === "WARNING_RESERVED_PROPERTY_CONFLICT")).toBe(true);
		await api.shutdown().catch(() => {});
	});
});
