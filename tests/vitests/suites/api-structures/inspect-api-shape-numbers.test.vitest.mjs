/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-structures/inspect-api-shape-numbers.test.vitest.mjs
 *	@Date: 2026-10-11T20:53:38-07:00 (1791777218)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T13:27:35-07:00 (1791836855)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The structure check's api shape keeps numbers JSON would merge, and array lengths (#585 review).
 * @description
 * The shape is printed as JSON, which writes `NaN` and both infinities as `null` and `-0` as `0`, so two
 * apis differing only in those values would compare equal. Fixture `api_test_special_numbers` exports
 * each of them beside a real `0` and `null`. An array's `length` is part of its shape too: `arrays.mjs`
 * exports two arrays with the same enumerable elements, one with a trailing hole. `nested.mjs` exports a
 * member deeper than the display depth, which the shape still compares, and `_hidden()`, which the
 * callable paths list.
 * @module tests/vitests/suites/api-structures/inspect-api-shape-numbers
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * Run the inspection tool on the fixture and read the api shape it prints.
 * @param {"--eager"|"--lazy"} modeFlag - Mode flag.
 * @returns {{stdout: string, members: object}} The tool's output and the api root's members.
 */
function runTool(modeFlag) {
	const result = spawnSync("node", [path.join(ROOT, "tools", "dev", "inspect-api-structure.mjs"), "api_test_special_numbers", modeFlag], {
		cwd: ROOT,
		encoding: "utf8",
		env: { ...process.env, NODE_ENV: "development", NODE_OPTIONS: "--conditions=slothlet-dev" }
	});
	const line = result.stdout.split("\n").find((entry) => entry.startsWith("API Shape: "));
	expect(line, result.stderr).toBeDefined();
	return { stdout: result.stdout, members: JSON.parse(line.slice("API Shape: ".length)).members };
}

/**
 * Read the api shape the inspection tool prints for the fixture.
 * @param {"--eager"|"--lazy"} modeFlag - Mode flag.
 * @returns {object} The api root's members.
 */
function shapeOf(modeFlag) {
	return runTool(modeFlag).members;
}

describe.each(["--eager", "--lazy"])("inspect-api-structure shape numbers (%s)", (modeFlag) => {
	it("tells NaN, the infinities and -0 apart from null and 0", () => {
		const members = shapeOf(modeFlag).values.members;
		const values = Object.fromEntries(Object.entries(members).map(([key, shape]) => [key, shape.value]));
		expect(new Set([values.notANumber, values.infinity, values.negativeInfinity, values.nothing]).size).toBe(4);
		expect(values.negativeZero).not.toEqual(values.zero);
		expect(values.zero).toBe(0);
		expect(values.nothing).toBe(null);
	});

	it("tells apart arrays with the same elements and different lengths", () => {
		const arrays = shapeOf(modeFlag).arrays.members;
		expect(arrays.holey.length).toBe(2);
		expect(arrays.short.length).toBe(1);
	});

	it("compares the whole shape, below the display depth too", () => {
		let node = shapeOf(modeFlag).nested.members.tree;
		for (const key of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "leaf"]) node = node.members[key];
		expect(node).toEqual({ type: "number", value: 1 });
	});

	it("lists an underscore-prefixed function among the callable paths", () => {
		expect(runTool(modeFlag).stdout).toContain("api.nested._hidden()");
	});
});
