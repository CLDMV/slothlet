/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/worker-execargv.test.vitest.mjs
 *	@Date: 2026-11-04T20:43:55-08:00 (1793853835)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T20:48:46-08:00 (1793854126)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Vitest forks workers with the config's `test.execArgv`; `test.nodeOptions` is not an option and passes nothing (#710).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";

const useSource = existsSync(new URL("../../../../src/slothlet.mjs", import.meta.url));

describe("vitest worker flags (#710)", () => {
	it("passes --conditions=slothlet-dev to the worker as an execArgv flag in source mode", () => {
		expect(process.execArgv.includes("--conditions=slothlet-dev")).toBe(useSource);
	});

	it("runs env-preload.mjs in the worker via --import", () => {
		expect(process.execArgv.some((arg) => arg.includes("env-preload.mjs"))).toBe(true);
	});
});
