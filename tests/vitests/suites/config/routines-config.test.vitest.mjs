/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/config/routines-config.test.vitest.mjs
 *	@Date: 2026-09-08T00:00:00-07:00 (1788850800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:21-08:00 (1795869081)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Coverage for issue #341's `routines` config normalization and the
 * `slothlet.defaults` namespace: entry-form parsing, validation, replace-not-merge semantics, and
 * the frozen/derived contract of `slothlet.defaults`.
 * @module tests/vitests/suites/config/routines-config
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { DEFAULT_ROUTINES, RESERVED_EXPORTS } from "#helpers/defaults";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

describe("slothlet.defaults", () => {
	it("is frozen at every level and carries routines + reserved", () => {
		expect(Object.isFrozen(slothlet.defaults)).toBe(true);
		expect(Object.isFrozen(slothlet.defaults.routines)).toBe(true);
		for (const entry of slothlet.defaults.routines) {
			expect(Object.isFrozen(entry)).toBe(true);
		}
		expect(Object.isFrozen(slothlet.defaults.reserved)).toBe(true);
	});

	it("routines is exactly the documented built-in default", () => {
		expect(slothlet.defaults.routines).toEqual([
			{ name: "initialize", mode: "startup" },
			{ name: "shutdown", mode: "shutdown" }
		]);
	});

	it("routines is the exact DEFAULT_ROUTINES export from helpers/defaults — single source of truth", () => {
		expect(slothlet.defaults.routines).toBe(DEFAULT_ROUTINES);
	});

	it("reserved is the exact RESERVED_EXPORTS export from helpers/defaults — single source of truth", () => {
		expect(slothlet.defaults.reserved).toBe(RESERVED_EXPORTS);
	});

	it("reserved is a non-empty Set of framework-internal names", () => {
		expect(slothlet.defaults.reserved).toBeInstanceOf(Set);
		expect(slothlet.defaults.reserved.size).toBeGreaterThan(0);
		expect(slothlet.defaults.reserved.has("____childFilePaths")).toBe(true);
	});

	it("reserved genuinely rejects mutation — Object.freeze() alone does not stop Set.add/delete/clear", () => {
		// A bare `Object.freeze(new Set())` still lets add/delete/clear through (freeze only locks
		// own properties, never a Set's internal slots) — this is what actually guards it.
		const sizeBefore = slothlet.defaults.reserved.size;
		expect(() => slothlet.defaults.reserved.add("__not_real")).toThrow(TypeError);
		expect(() => slothlet.defaults.reserved.delete("____childFilePaths")).toThrow(TypeError);
		expect(() => slothlet.defaults.reserved.clear()).toThrow(TypeError);
		expect(slothlet.defaults.reserved.size).toBe(sizeBefore);
		expect(slothlet.defaults.reserved.has("____childFilePaths")).toBe(true);
	});
});

describe("routines config normalization", () => {
	/** @type {object} */
	let api;

	afterEach(async () => {
		if (api) {
			await api.slothlet.shutdown();
			api = undefined;
		}
	});

	it("omitting routines keeps the built-in defaults", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, silent: true });
		expect(typeof api.initialize).toBe("function");
		expect(api.initialize.____slothletRoutineStack).toBe(true);
	});

	it("routines: [] disables every routine — no auto-run, no generated cascade", async () => {
		globalThis.__slothletRoutineLog = [];
		api = await slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: { entries: [] }, silent: true });
		expect(globalThis.__slothletRoutineLog).toEqual([]);
		// With no configured routines, "initialize" is an ordinary merged leaf — not a cascade.
		expect(typeof api.initialize).toBe("function");
		expect(api.initialize.____slothletRoutineStack).toBeUndefined();
	});

	it('string entry "name" normalizes to mode "manual"', async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST_ROUTINES_MANUAL, routines: { entries: ["launch"] }, silent: true });
		expect(globalThis.__slothletRoutineLog ?? []).not.toContain("manual:launch"); // manual never auto-runs
		await api.launch();
		expect(globalThis.__slothletRoutineLog).toContain("manual:launch");
	});

	it('string entry "name:mode" splits on the first colon', async () => {
		globalThis.__slothletRoutineLog = [];
		api = await slothlet({ base: TEST_DIRS.API_TEST_ROUTINES_MANUAL, routines: { entries: ["launch:startup"], auto: true }, silent: true });
		// startup mode auto-runs once at compose end — no manual call needed.
		expect(globalThis.__slothletRoutineLog).toContain("manual:launch");
	});

	it('object entry "{ name }" defaults to mode "manual"', async () => {
		globalThis.__slothletRoutineLog = [];
		api = await slothlet({ base: TEST_DIRS.API_TEST_ROUTINES_MANUAL, routines: { entries: [{ name: "launch" }] }, silent: true });
		expect(globalThis.__slothletRoutineLog).toEqual([]);
		await api.launch();
		expect(globalThis.__slothletRoutineLog).toContain("manual:launch");
	});

	it('object entry "{ name, mode }" is used verbatim', async () => {
		globalThis.__slothletRoutineLog = [];
		api = await slothlet({
			base: TEST_DIRS.API_TEST_ROUTINES_MANUAL,
			routines: {
				entries: [{ name: "launch", mode: "startup" }],
				auto: true
			},
			silent: true
		});
		expect(globalThis.__slothletRoutineLog).toContain("manual:launch");
	});

	it("spreading slothlet.defaults.routines extends the built-ins instead of replacing them", async () => {
		globalThis.__slothletRoutineLog = [];
		api = await slothlet({
			base: TEST_DIRS.API_TEST_ROUTINES_MANUAL,
			routines: {
				entries: [...slothlet.defaults.routines, "launch:startup"],
				auto: true
			},
			silent: true
		});
		expect(globalThis.__slothletRoutineLog).toContain("manual:launch");
		// The built-in "initialize"/"shutdown" defaults are still active alongside the custom one.
		expect(typeof api.initialize).toBe("function");
		expect(api.initialize.____slothletRoutineStack).toBe(true);
	});

	it("filtering slothlet.defaults.routines drops just the named default", async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST_ROUTINES,
			routines: { entries: slothlet.defaults.routines.filter((r) => r.name !== "shutdown") },
			silent: true
		});
		// "initialize" (startup) is still configured...
		expect(api.initialize.____slothletRoutineStack).toBe(true);
		// ...but "shutdown" is no longer a configured routine, so it stays the plain internal builtin.
		expect(typeof api.shutdown).toBe("function");
	});

	it("providing routines REPLACES the defaults — a bare custom list drops initialize/shutdown", async () => {
		globalThis.__slothletRoutineLog = [];
		api = await slothlet({ base: TEST_DIRS.API_TEST_ROUTINES_MANUAL, routines: { entries: ["launch"] }, silent: true });
		// The default "initialize" startup routine did NOT run — routines: [...] replaced it away.
		expect(globalThis.__slothletRoutineLog).toEqual([]);
	});

	it("rejects a non-object routines value", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: "nope", silent: true })).rejects.toMatchObject({
				code: "INVALID_CONFIG"
			});
		});
	});

	it("rejects an invalid entry mode", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: { entries: [{ name: "x", mode: "bogus" }] }, silent: true })
			).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		});
	});

	it("rejects an empty-string name", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: { entries: [""] }, silent: true })).rejects.toMatchObject({
				code: "INVALID_CONFIG"
			});
		});
	});

	it('rejects a bare "^" name (root-anchored with nothing after it, matches no path ever)', async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: { entries: ["^"] }, silent: true })).rejects.toMatchObject({
				code: "INVALID_CONFIG"
			});
		});
	});

	it('rejects the reserved routine name "slothlet"', async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: { entries: ["slothlet"] }, silent: true })
			).rejects.toMatchObject({
				code: "INVALID_CONFIG"
			});
		});
	});

	it.each(["__proto__", "constructor", "prototype"])("rejects the prototype-pollution meta-key %j as a routine name", async (name) => {
		// A routine's name is used verbatim as a property key (api[name]) —
		// one of these would mutate the object's prototype chain instead of installing a property.
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: { entries: [name] }, silent: true })).rejects.toMatchObject({
				code: "INVALID_CONFIG"
			});
		});
	});

	it("rejects a non-string, non-object entry", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: { entries: [42] }, silent: true })).rejects.toMatchObject({
				code: "INVALID_CONFIG"
			});
		});
	});

	it("rejects a non-boolean recursive value", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({ base: TEST_DIRS.API_TEST_ROUTINES, routines: { entries: [{ name: "x", recursive: "yes" }] }, silent: true })
			).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		});
	});

	it("the string shorthand always normalizes recursive to false", async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST_ROUTINES_NESTED,
			routines: { entries: ["initialize:startup"], auto: true },
			silent: true
		});
		// recursive: false (the shorthand can't set it) — only the mount's own top level counts.
		expect(globalThis.__slothletRoutineLog).toEqual(["nested:top:initialize"]);
	});
});
