/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/diagnostics/warning-per-instance.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:47-08:00 (1794882587)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #819 — each instance keeps its own warnings. Two instances do not share
 * `api.slothlet.warnings.get()`, `warnings.clear()` on one leaves the other's list alone, a warning is kept
 * whether or not it was printed, and one raised outside any instance is kept by none. #838 — an instance's `silent`
 * decides only whether a warning is also printed, and one instance's `silent` does not touch the other.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const CASES = [
	{ mode: "eager", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * Raise a WARNING_COLLISION_OPTION_LOCKED on an instance (a locked per-call add option).
 * @param {object} api - Bound api.
 * @returns {Promise<void>}
 */
const raise = (api) => api.slothlet.api.add("extra", { exports: { ping: () => "pong" } }, { collision: { mode: "replace" } });

/**
 * Codes of an instance's captured warnings.
 * @param {object} api - Bound api.
 * @returns {string[]} Codes.
 */
const codes = (api) => api.slothlet.warnings.get().map((w) => w.code);

describe.each(CASES)("warning capture is per instance (#819) > $mode / $runtime", ({ mode, runtime }) => {
	let a;
	let b;

	const make = (silent = false) => slothlet({ base: TEST_DIRS.API_TEST, mode, runtime, diagnostics: true, silent });

	afterEach(async () => {
		vi.restoreAllMocks();
		if (a) await a.shutdown();
		if (b) await b.shutdown();
		a = b = null;
	});

	it("a warning on one instance is captured on that instance only", async () => {
		a = await make();
		b = await make();
		await raise(a);
		expect(codes(a)).toContain("WARNING_COLLISION_OPTION_LOCKED");
		expect(codes(b)).not.toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("warnings.clear() on one instance leaves the other's warnings", async () => {
		a = await make();
		b = await make();
		await raise(a);
		await raise(b);
		a.slothlet.warnings.clear();
		expect(codes(a)).toEqual([]);
		expect(codes(b)).toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("silent on one instance does not change the other, and both record their warnings (#838)", async () => {
		a = await make(false);
		b = await make(true);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await raise(a);
		expect(warn).toHaveBeenCalled();
		warn.mockClear();
		await raise(b);
		expect(warn).not.toHaveBeenCalled();
		expect(codes(a)).toContain("WARNING_COLLISION_OPTION_LOCKED");
		expect(codes(b)).toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("a warning raised outside any instance is kept by no instance", async () => {
		a = await make();
		new SlothletWarning("WARNING_COLLISION_OPTION_LOCKED", { option: "x" });
		expect(codes(a)).not.toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("get() returns a copy: changing it leaves the instance's list alone", async () => {
		a = await make();
		await raise(a);
		const list = a.slothlet.warnings.get();
		list.length = 0;
		expect(codes(a)).toContain("WARNING_COLLISION_OPTION_LOCKED");
	});

	it("the warning class has no process-wide captured list", () => {
		expect(SlothletWarning).not.toHaveProperty("captured");
		expect(SlothletWarning).not.toHaveProperty("clearCaptured");
	});

	it("diag no longer hands out the warning class", async () => {
		a = await make();
		expect(a.slothlet.diag).not.toHaveProperty("SlothletWarning");
	});

	it("instance warnings are still SlothletWarning instances", async () => {
		a = await make();
		await raise(a);
		expect(a.slothlet.warnings.get()[0]).toBeInstanceOf(SlothletWarning);
	});
});

describe("slothlet.warnings is host-only while permissions are on", () => {
	const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_warnings");
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("module code is refused by the built-in rule", async () => {
		api = await slothlet({ base: BASE, permissions: { mode: "on" } });
		await expect((async () => api.monitor.codes())()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
	});

	it("a rule on slothlet.warnings.get lets module code read it", async () => {
		api = await slothlet({
			base: BASE,
			permissions: { mode: "on", rules: [{ caller: "monitor.**", target: "slothlet.warnings.get", effect: "allow" }] }
		});
		expect(await api.monitor.codes()).toEqual(api.slothlet.warnings.get().map((w) => w.code));
	});

	it("with permissions off, module code reads it", async () => {
		api = await slothlet({ base: BASE });
		expect(Array.isArray(await api.monitor.codes())).toBe(true);
	});
});
