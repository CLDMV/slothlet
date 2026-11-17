/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/diagnostics/warning-per-instance.test.vitest.mjs
 *	@Date: 2026-11-15T12:00:00-08:00 (1794772800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:00:00-08:00 (1794772800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #819 — each instance keeps its own warnings. Two instances do not share
 * `api.slothlet.warnings.get()`, `warnings.clear()` on one leaves the other's list alone, a warning is kept
 * whether or not it was printed, and one raised outside any instance is kept by none.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
 * Raise a WARNING_API_ADD_OPTION_LOCKED on an instance (a locked per-call add option).
 * @param {object} api - Bound api.
 * @returns {Promise<void>}
 */
const raise = (api) => api.slothlet.api.add("extra", { exports: { ping: () => "pong" } }, { collisionMode: "replace" });

/**
 * Codes of an instance's captured warnings.
 * @param {object} api - Bound api.
 * @returns {string[]} Codes.
 */
const codes = (api) => api.slothlet.warnings.get().map((w) => w.code);

describe.each(CASES)("warning capture is per instance (#819) > $mode / $runtime", ({ mode, runtime }) => {
	let a;
	let b;

	const make = () => slothlet({ base: TEST_DIRS.API_TEST, mode, runtime, diagnostics: true });

	beforeEach(() => {
		SlothletWarning.suppressConsole = true;
	});

	afterEach(async () => {
		SlothletWarning.suppressConsole = false;
		vi.restoreAllMocks();
		if (a) await a.shutdown();
		if (b) await b.shutdown();
		a = b = null;
	});

	it("a warning on one instance is captured on that instance only", async () => {
		a = await make();
		b = await make();
		await raise(a);
		expect(codes(a)).toContain("WARNING_API_ADD_OPTION_LOCKED");
		expect(codes(b)).not.toContain("WARNING_API_ADD_OPTION_LOCKED");
	});

	it("warnings.clear() on one instance leaves the other's warnings", async () => {
		a = await make();
		b = await make();
		await raise(a);
		await raise(b);
		a.slothlet.warnings.clear();
		expect(codes(a)).toEqual([]);
		expect(codes(b)).toContain("WARNING_API_ADD_OPTION_LOCKED");
	});

	it("a warning is kept by its instance whether or not it was printed", async () => {
		a = await make();
		b = await make();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		SlothletWarning.suppressConsole = false;
		await raise(a);
		expect(warn).toHaveBeenCalled();
		expect(codes(a)).toContain("WARNING_API_ADD_OPTION_LOCKED");
		expect(codes(b)).not.toContain("WARNING_API_ADD_OPTION_LOCKED");
	});

	it("a warning raised outside any instance is kept by no instance", async () => {
		a = await make();
		new SlothletWarning("WARNING_API_ADD_OPTION_LOCKED", { option: "x" });
		expect(codes(a)).not.toContain("WARNING_API_ADD_OPTION_LOCKED");
	});

	it("instance warnings are still SlothletWarning instances", async () => {
		a = await make();
		await raise(a);
		expect(a.slothlet.warnings.get()[0]).toBeInstanceOf(SlothletWarning);
	});
});
