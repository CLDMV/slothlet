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
 * @fileoverview #819 — warning capture and console suppression are per instance. Two instances do not share
 * `api.slothlet.diag.SlothletWarning.captured`, `clearCaptured()` on one leaves the other's list alone, and
 * `suppressConsole` set on one instance does not touch the other. A warning raised outside any instance lands
 * on the process-level `SlothletWarning` from `@cldmv/slothlet/errors`.
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
const codes = (api) => api.slothlet.diag.SlothletWarning.captured.map((w) => w.code);

describe.each(CASES)("warning capture is per instance (#819) > $mode / $runtime", ({ mode, runtime }) => {
	let a;
	let b;

	const make = () => slothlet({ base: TEST_DIRS.API_TEST, mode, runtime, diagnostics: true });

	beforeEach(() => {
		SlothletWarning.suppressConsole = true;
		SlothletWarning.clearCaptured();
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

	it("clearCaptured() on one instance leaves the other's warnings", async () => {
		a = await make();
		b = await make();
		await raise(a);
		await raise(b);
		a.slothlet.diag.SlothletWarning.clearCaptured();
		expect(codes(a)).toEqual([]);
		expect(codes(b)).toContain("WARNING_API_ADD_OPTION_LOCKED");
	});

	it("suppressConsole on one instance does not change the other", async () => {
		a = await make();
		b = await make();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		a.slothlet.diag.SlothletWarning.suppressConsole = false;
		await raise(a);
		expect(warn).toHaveBeenCalled();
		warn.mockClear();
		await raise(b);
		expect(warn).not.toHaveBeenCalled();
		expect(codes(b)).toContain("WARNING_API_ADD_OPTION_LOCKED");
		expect(codes(a)).not.toContain("WARNING_API_ADD_OPTION_LOCKED");
	});

	it("a warning raised outside any instance lands on the process-level class", async () => {
		a = await make();
		SlothletWarning.clearCaptured();
		new SlothletWarning("WARNING_API_ADD_OPTION_LOCKED", { option: "x" });
		expect(SlothletWarning.captured.map((w) => w.code)).toContain("WARNING_API_ADD_OPTION_LOCKED");
		expect(codes(a)).not.toContain("WARNING_API_ADD_OPTION_LOCKED");
		SlothletWarning.clearCaptured();
	});

	it("instance warnings are still SlothletWarning instances", async () => {
		a = await make();
		await raise(a);
		expect(a.slothlet.diag.SlothletWarning.captured[0]).toBeInstanceOf(SlothletWarning);
	});
});
