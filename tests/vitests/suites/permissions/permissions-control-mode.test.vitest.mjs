/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-control-mode.test.vitest.mjs
 *	@Date: 2026-11-16T18:34:36-08:00 (1794882876)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:34:36-08:00 (1794882876)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions.control.mode(value?)` and `permissions.control.gating.read(value?)`: read without an
 * argument, switch with one. "strict" is config-only, "disabled" can be left but not entered, and `seal()` locks
 * switching but not reading.
 * @module tests/vitests/suites/permissions/permissions-control-mode.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("permissions.control.mode / gating.read", () => {
	let api;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	const load = async (permissions) => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, silent: true, permissions });
		return api.slothlet.permissions.control;
	};

	it("reads the mode without an argument and switches it with one", async () => {
		const control = await load({ mode: "on" });
		expect(control.mode()).toBe("on");
		expect(control.mode("off")).toBe("off");
		expect(control.mode()).toBe("off");
		expect(control.mode(true)).toBe("on");
		expect(control.mode(false)).toBe("off");
		expect(control.mode("on")).toBe("on");
	});

	it("leaves disabled, but never enters it", async () => {
		const control = await load({ mode: "disabled" });
		expect(control.mode()).toBe("disabled");
		// Asking for the mode it already has changes nothing.
		expect(control.mode("disabled")).toBe("disabled");
		expect(control.mode("on")).toBe("on");
		expect(() => control.mode("disabled")).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
		expect(control.mode()).toBe("on");
	});

	it("never enters strict", async () => {
		const control = await load({ mode: "on" });
		expect(() => control.mode("strict")).toThrow(expect.objectContaining({ code: "PERMISSION_STRICT_FIXED" }));
		expect(control.mode()).toBe("on");
	});

	it.each([
		["a number", 1],
		["an unknown name", "partial"],
		["null", null],
		["undefined", undefined]
	])("refuses %s", async (_label, value) => {
		const control = await load({ mode: "on" });
		expect(() => control.mode(value)).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
		expect(control.mode()).toBe("on");
	});

	it("seal() locks switching the mode and read gating, not reading them", async () => {
		const control = await load({ mode: "on" });
		control.seal();
		expect(() => control.mode("off")).toThrow(expect.objectContaining({ code: "PERMISSION_SEALED" }));
		expect(() => control.gating.read(false)).toThrow(expect.objectContaining({ code: "PERMISSION_SEALED" }));
		expect(control.mode()).toBe("on");
		expect(control.gating.read()).toBe(true);
	});

	it("gating.read reads without an argument and switches with a boolean", async () => {
		const control = await load({ mode: "on" });
		expect(control.gating.read()).toBe(true);
		expect(control.gating.read(false)).toBe(false);
		expect(control.gating.read()).toBe(false);
		expect(control.gating.read(true)).toBe(true);
		expect(() => control.gating.read("yes")).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
	});

	it("the v3 members are gone", async () => {
		const control = await load({ mode: "on" });
		for (const name of ["enable", "disable", "enabled", "readGating", "readGatingEnabled"]) expect(control).not.toHaveProperty(name);
	});
});
