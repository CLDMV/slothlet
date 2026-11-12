/**
 * @fileoverview A `**` segment matches zero or more segments wherever it stands in a pattern, in every place slothlet
 * compiles one (permission rules, hooks, routines, the loader's `hidden` globs).
 *
 * Expected values come from the rule as it is written in PERMISSIONS.md and HOOKS.md: each `**` that is a whole
 * segment stands for any number of segments, none included, and takes the `.` beside it with it.
 * @module tests/vitests/suites/helpers/pattern-matcher-globstar
 */

import { describe, it, expect } from "vitest";
import { compilePattern } from "@cldmv/slothlet/helpers/pattern-matcher";

/**
 * Rows of `[pattern, path, matches]`.
 * @type {Array<[string, string, boolean]>}
 */
const ROWS = [
	// one `**` at the end, the start and the middle
	["a.**", "a", true],
	["a.**", "a.b", true],
	["a.**", "a.b.c", true],
	["a.**", "ab", false],
	["a.**", "b.a", false],
	["**.a", "a", true],
	["**.a", "x.a", true],
	["**.a", "x.y.a", true],
	["**.a", "xa", false],
	["**.a", "a.x", false],
	["a.**.b", "a.b", true],
	["a.**.b", "a.x.b", true],
	["a.**.b", "a.x.y.b", true],
	["a.**.b", "ab", false],
	["a.**.b", "a.b.c", false],
	["**", "a", true],
	["**", "a.b.c", true],
	// consecutive `**`
	["a.**.**", "a", true],
	["a.**.**", "a.b", true],
	["a.**.**", "a.b.c", true],
	["a.**.**", "b", false],
	["a.**.**.b", "a.b", true],
	["a.**.**.b", "a.x.b", true],
	["a.**.**.b", "a.x.y.z.b", true],
	["a.**.**.b", "a.c", false],
	["**.**", "a", true],
	["**.**", "a.b", true],
	["**.**.a", "a", true],
	["**.**.a", "x.y.a", true],
	["**.**.a", "b", false],
	["a.**.**.**", "a", true],
	// several `**` apart from each other
	["a.**.b.**", "a.b", true],
	["a.**.b.**", "a.x.b", true],
	["a.**.b.**", "a.x.b.y.z", true],
	["a.**.b.**", "a.x", false],
	["**.a.**", "a", true],
	["**.a.**", "x.a.y", true],
	["**.a.**", "x.y", false],
	["a.**.b.**.c", "a.b.c", true],
	["a.**.b.**.c", "a.x.b.y.c", true],
	["a.**.b.**.c", "a.c", false],
	// mixed with `*`, which is always exactly one segment
	["a.**.*", "a", false],
	["a.**.*", "a.b", true],
	["a.**.*", "a.b.c", true],
	["a.*.**", "a", false],
	["a.*.**", "a.b", true],
	["a.*.**", "a.b.c.d", true],
	["*.**", "a", true],
	["*.**", "a.b.c", true],
	["**.*", "a", true],
	["**.*", "a.b", true],
	["a.**.*.**.b", "a.b", false],
	["a.**.*.**.b", "a.x.b", true],
	["a.**.*.**.b", "a.x.y.z.b", true],
	["*.**.*", "a", false],
	["*.**.*", "a.b", true],
	// with braces and a whole-pattern negation
	["{a,b}.**.**", "b", true],
	["{a,b}.**.**", "c", false],
	["a.{**,x}.**", "a", true],
	["!a.**.**", "a", false],
	["!a.**.**", "b", true],
	// a `**` inside a segment keeps meaning "any characters, dots included"
	["a.b**", "a.b", true],
	["a.b**", "a.bcd.e", true],
	["a.b**", "a", false]
];

describe("pattern matcher: a ** segment matches zero or more segments", () => {
	it.each(ROWS)("%s against %s is %s", (pattern, path, matches) => {
		expect(compilePattern(pattern)(path)).toBe(matches);
	});
});
