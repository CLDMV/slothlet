/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-pattern-matcher.test.vitest.mjs
 *	@Date: 2026-04-14 17:20:57 -07:00 (1776212457)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:33:59 -07:00 (1776213239)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect } from "vitest";
import { compilePattern, expandBraces, splitBraceAlternatives } from "@cldmv/slothlet/helpers/pattern-matcher";

describe("Permissions > Pattern Matcher Unit Tests", () => {
	describe("compilePattern", () => {
		it("exact match", () => {
			const matcher = compilePattern("payments.charge");
			expect(matcher("payments.charge")).toBe(true);
			expect(matcher("payments.refund")).toBe(false);
		});

		it("single glob * matches one segment", () => {
			const matcher = compilePattern("payments.*");
			expect(matcher("payments.charge")).toBe(true);
			expect(matcher("payments.refund")).toBe(true);
			expect(matcher("payments.charge.sub")).toBe(false);
			expect(matcher("admin.manage")).toBe(false);
		});

		it("double glob ** matches multiple segments", () => {
			const matcher = compilePattern("payments.**");
			expect(matcher("payments.charge")).toBe(true);
			expect(matcher("payments.charge.sub")).toBe(true);
			expect(matcher("payments")).toBe(false);
			expect(matcher("admin.manage")).toBe(false);
		});

		it("? matches single character in segment", () => {
			const matcher = compilePattern("db.rea?");
			expect(matcher("db.read")).toBe(true);
			expect(matcher("db.real")).toBe(true);
			expect(matcher("db.reads")).toBe(false);
		});

		it("negation pattern", () => {
			const matcher = compilePattern("!payments.**");
			expect(matcher("payments.charge")).toBe(false);
			expect(matcher("admin.manage")).toBe(true);
		});

		it("brace expansion", () => {
			const matcher = compilePattern("{payments,admin}.**");
			expect(matcher("payments.charge")).toBe(true);
			expect(matcher("admin.manage")).toBe(true);
			expect(matcher("db.read")).toBe(false);
		});
	});

	describe("expandBraces", () => {
		it("expands simple brace alternatives", () => {
			const results = expandBraces("{a,b}.c");
			expect(results).toEqual(expect.arrayContaining(["a.c", "b.c"]));
			expect(results.length).toBe(2);
		});

		it("returns original if no braces", () => {
			const results = expandBraces("a.b.c");
			expect(results).toEqual(["a.b.c"]);
		});
	});

	describe("splitBraceAlternatives", () => {
		it("splits comma-separated alternatives", () => {
			const results = splitBraceAlternatives("a,b,c");
			expect(results).toEqual(["a", "b", "c"]);
		});

		it("respects nested braces", () => {
			const results = splitBraceAlternatives("a,{b,c},d");
			expect(results).toEqual(["a", "{b,c}", "d"]);
		});
	});
});
