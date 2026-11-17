/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/stack-text-frames.test.vitest.mjs
 *	@Date: 2026-11-16T00:01:47-08:00 (1794816107)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:58-08:00 (1794882538)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Stacks formatted as text (Firefox, Safari): code compiled from a string is marked evaluated, never taken
 * for the code of the file that compiled it (#693).
 *
 * @description
 * The stacks are the formats the engines write, captured from Firefox 159 and WebKit 27.2 under Playwright. SpiderMonkey
 * names the file and line code was compiled at, then what compiled it: `@file line 7 > eval:1:1`,
 * `anonymous@file line 7 > Function:3:8`, and a function declared inside such code the same way. JavaScriptCore gives
 * eval and `Function` code, and every function declared inside it, no location: `eval code@`, `anonymous@`, `inner@`,
 * with the built-in that ran it as `eval@[native code]`. A frame marked evaluated is never placed on a leaf
 * (PERMISSIONS.md, "Evaluated code … is never placed on the leaf").
 * @module tests/vitests/suites/context/stack-text-frames
 */

import { describe, it, expect } from "vitest";
import { textFrames } from "#handlers/frame-placement";

const FILE = "http://localhost/api/good/good.mjs";
const PAGE = "http://localhost/page.html";

/**
 * The frames of a stack, as `[path, evaluated]` pairs.
 * @param {string} text - The stack.
 * @returns {Array<[string, boolean]>} The pairs.
 */
const marks = (text) => textFrames(text, 50).map((frame) => [frame.path, frame.evaluated]);

describe("stack text frames > SpiderMonkey (Firefox)", () => {
	it("marks an eval frame evaluated and keeps the file's own frame", () => {
		expect(marks(`@${FILE} line 7 > eval:1:1\nrun@${FILE}:7:6`)).toEqual([
			[`${FILE} line 7 > eval`, true],
			[FILE, false]
		]);
	});

	it("marks a Function frame evaluated", () => {
		expect(marks(`anonymous@${FILE} line 7 > Function:1:1\nrun@${FILE}:7:6`)).toEqual([
			[`${FILE} line 7 > Function`, true],
			[FILE, false]
		]);
	});

	it("marks nested eval frames evaluated", () => {
		expect(marks(`@${FILE} line 7 > eval line 1 > eval:1:1\n@${FILE} line 7 > eval:1:1\n@${FILE}:7:6`)).toEqual([
			[`${FILE} line 7 > eval line 1 > eval`, true],
			[`${FILE} line 7 > eval`, true],
			[FILE, false]
		]);
	});

	it("marks a function declared inside Function code evaluated", () => {
		expect(
			marks(`grab@${PAGE}:2:25\ninner@${PAGE} line 8 > Function:3:34\nanonymous@${PAGE} line 8 > Function:3:44\n@${PAGE}:8:72\n`)
		).toEqual([
			[PAGE, false],
			[`${PAGE} line 8 > Function`, true],
			[`${PAGE} line 8 > Function`, true],
			[PAGE, false]
		]);
	});

	it("marks any other compiled step evaluated", () => {
		expect(marks(`@${FILE} line 9 > injectedScript:1:1`)).toEqual([[`${FILE} line 9 > injectedScript`, true]]);
	});

	it("marks eval code a module file runs evaluated, below the module's own frame", () => {
		expect(marks(`run@${FILE}:1:31\n@${PAGE} line 19 > eval:1:1\n@${PAGE}:19:26\n`)).toEqual([
			[FILE, false],
			[`${PAGE} line 19 > eval`, true],
			[PAGE, false]
		]);
	});

	it("does not take a function name that names a file for the location", () => {
		expect(marks(`x@${FILE}:1:1@http://localhost:5173/rogue.js line 3 > eval:1:1`)).toEqual([
			["http://localhost:5173/rogue.js line 3 > eval", true]
		]);
	});

	it("leaves a file's own frames unmarked", () => {
		expect(marks(`run@${FILE}:4:9\n@http://localhost:5173/main.js:12:3`)).toEqual([
			[FILE, false],
			["http://localhost:5173/main.js", false]
		]);
	});
});

describe("stack text frames > JavaScriptCore (Safari)", () => {
	it("marks eval code, which has no location, evaluated and passes the eval built-in over", () => {
		expect(marks(`eval code@\neval@[native code]\nrun@${FILE}:7:6\nglobal code@http://localhost:5173/main.js:12:3`)).toEqual([
			["", true],
			[FILE, false],
			["http://localhost:5173/main.js", false]
		]);
	});

	it("marks Function code, and a function declared inside it, which have no location, evaluated", () => {
		expect(marks(`grab@${PAGE}:2:34\ninner@\nanonymous@\nglobal code@${PAGE}:8:72`)).toEqual([
			[PAGE, false],
			["", true],
			["", true],
			[PAGE, false]
		]);
	});

	it("marks nested eval code evaluated", () => {
		expect(marks(`grab@${PAGE}:2:34\neval code@\neval@[native code]\neval code@\neval@[native code]\nglobal code@${PAGE}:6:18`)).toEqual([
			[PAGE, false],
			["", true],
			["", true],
			[PAGE, false]
		]);
	});

	it("marks a frame with no location evaluated whatever its function name names", () => {
		expect(marks(`x@${FILE}:1:1@\nrun@${FILE}:7:6`)).toEqual([
			[expect.any(String), true],
			[FILE, false]
		]);
	});

	it("passes a built-in's frame over whatever its function name names", () => {
		expect(marks(`map@[native code]\ny@${FILE}:1:1@[native code]\nrun@${FILE}:7:6`)).toEqual([[FILE, false]]);
	});
});

describe("stack text frames > V8 text", () => {
	it("marks an eval frame evaluated", () => {
		expect(marks(`    at eval (eval at run (${FILE}:7:6), <anonymous>:1:1)\n    at run (${FILE}:7:6)`)).toEqual([
			[expect.any(String), true],
			[FILE, false]
		]);
	});
});

describe("stack text frames > budget", () => {
	it("reports a stack cut off at the budget", () => {
		expect(textFrames(`a@${FILE}:1:1\nb@${FILE}:2:1`, 2).truncated).toBe(true);
		expect(textFrames(`a@${FILE}:1:1`, 2).truncated).toBe(false);
	});
});
