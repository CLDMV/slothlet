/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runner/run-all-vitest-args.test.vitest.mjs
 *	@Date: 2026-11-25T01:28:58-08:00 (1795598938)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:48:22-08:00 (1795600102)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Argument parsing of tests/vitests/run-all-vitest.mjs (npm run vitest).
 * @module tests/vitests/suites/runner/run-all-vitest-args.test.vitest
 */

import { describe, it, expect } from "vitest";
import { parseArguments, findUnmatchedSelectors, coverageIncludeFromArgs } from "../../run-all-vitest.mjs";

const FILE = "tests/vitests/suites/config/clock-option.test.vitest.mjs";

describe("run-all-vitest argument parsing", () => {
	it("keeps a test path after --flag=value as a selector (#954)", () => {
		const parsed = parseArguments(["--coverage", "--coverage.include=src/lib/helpers/clock.mjs", FILE]);
		expect(parsed.testPatterns).toEqual([FILE]);
		expect(parsed.vitestArgs).toEqual(["--coverage", "--coverage.include=src/lib/helpers/clock.mjs"]);
	});

	it("keeps a test path after a bare flag as a selector", () => {
		const parsed = parseArguments(["--coverage", FILE]);
		expect(parsed.testPatterns).toEqual([FILE]);
		expect(parsed.vitestArgs).toEqual(["--coverage"]);
	});

	it("treats a suites/ folder and a short existing folder as selectors after a flag", () => {
		expect(parseArguments(["--bail", "suites/config"]).testPatterns).toEqual(["suites/config"]);
		expect(parseArguments(["--bail", "tests/vitests/suites/config"]).testPatterns).toEqual(["tests/vitests/suites/config"]);
	});

	it("still lets a bare flag take a separate non-path value", () => {
		const parsed = parseArguments(["-t", "lazy materialization", FILE]);
		expect(parsed.vitestArgs).toEqual(["-t", "lazy materialization"]);
		expect(parsed.testPatterns).toEqual([FILE]);
		const reporter = parseArguments(["--reporter", "verbose"]);
		expect(reporter.vitestArgs).toEqual(["--reporter", "verbose"]);
		expect(reporter.testPatterns).toEqual([]);
	});

	it("keeps the runner's own flags working", () => {
		const parsed = parseArguments(["--workers", "2", "--exclude", "x/**", "--coverage-quiet", FILE]);
		expect(parsed.workers).toBe(2);
		expect(parsed.excludePatterns).toContain("x/**");
		expect(parsed.coverageQuiet).toBe(true);
		expect(parsed.testPatterns).toEqual([FILE]);
	});
});

describe("run-all-vitest selector matching", () => {
	it("reports nothing when every selector matches a test file or folder", () => {
		expect(findUnmatchedSelectors([FILE, "suites/config", "clock-option"])).toEqual([]);
	});

	it("reports selectors that match no test file", () => {
		expect(findUnmatchedSelectors([FILE, "suites/does-not-exist/nope.test.vitest.mjs"])).toEqual([
			"suites/does-not-exist/nope.test.vitest.mjs"
		]);
	});
});

describe("run-all-vitest --coverage.include", () => {
	it("collects every --coverage.include given as name=value or as name value", () => {
		expect(coverageIncludeFromArgs(["--coverage", "--coverage.include=src/a.mjs", "--coverage.include", "src/b.mjs"])).toEqual([
			"src/a.mjs",
			"src/b.mjs"
		]);
	});

	it("returns an empty list when no include was given", () => {
		expect(coverageIncludeFromArgs(["--coverage", "--coverage.reporter=text"])).toEqual([]);
	});
});
