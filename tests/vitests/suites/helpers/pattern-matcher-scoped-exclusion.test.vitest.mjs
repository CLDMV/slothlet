/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/pattern-matcher-scoped-exclusion.test.vitest.mjs
 *	@Date: 2026-09-18 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-18 00:00:00 -07:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #360 — scoped exclusion extglob `!(a|b)` in compilePattern().
 *
 * `!(a|b)` is a PER-SEGMENT complement: it matches any single `.`-delimited segment that is not one
 * of the listed literal alternatives — distinct from the whole-pattern, depth-unbounded `!` negation.
 * These tests pin the segment-scoping, multi-alternative, position (leading/middle/trailing), and the
 * preservation of the existing `!`, `*`, `**`, `?`, and `{a,b}` behavior.
 *
 * @module tests/vitests/suites/helpers/pattern-matcher-scoped-exclusion.test.vitest
 */

import { describe, it, expect } from "vitest";
import { compilePattern } from "@cldmv/slothlet/helpers/pattern-matcher";

describe("pattern-matcher > scoped exclusion !(a|b) (#360)", () => {
	it("excludes exactly the listed segment; other siblings match", () => {
		const m = compilePattern("admin.!(initialize)");
		expect(m("admin.start")).toBe(true);
		expect(m("admin.initialize")).toBe(false);
		expect(m("admin.shutdown")).toBe(true);
	});

	it("is scoped to one segment — only the exact segment value is excluded, and depth is fixed", () => {
		const m = compilePattern("admin.!(initialize)");
		expect(m("admin.initializeX")).toBe(true); // not an exact match of "initialize"
		expect(m("admin.a.b")).toBe(false); // pattern is two segments; a three-segment path can't match
		expect(m("start")).toBe(false); // needs the "admin." prefix
	});

	it("supports multiple alternatives", () => {
		const m = compilePattern("admin.!(initialize|shutdown)");
		expect(m("admin.run")).toBe(true);
		expect(m("admin.initialize")).toBe(false);
		expect(m("admin.shutdown")).toBe(false);
	});

	it("works in leading, middle, and trailing segment positions", () => {
		const leading = compilePattern("!(admin).config");
		expect(leading("user.config")).toBe(true);
		expect(leading("admin.config")).toBe(false);

		const middle = compilePattern("admin.!(initialize).run");
		expect(middle("admin.foo.run")).toBe(true);
		expect(middle("admin.initialize.run")).toBe(false);
	});

	it("composes with * and ** elsewhere in the pattern", () => {
		const m = compilePattern("**.!(secret)");
		expect(m("a.b.public")).toBe(true);
		expect(m("a.b.secret")).toBe(false);
		expect(m("x.secret")).toBe(false);
		expect(m("x.other")).toBe(true);
	});

	it("`!()` with no alternatives excludes nothing — any single segment matches", () => {
		const m = compilePattern("admin.!()");
		expect(m("admin.anything")).toBe(true);
		expect(m("admin.x.y")).toBe(false); // still one segment only
	});

	it("does not disturb whole-pattern `!` negation (depth-unbounded)", () => {
		const m = compilePattern("!admin.initialize");
		expect(m("admin.initialize")).toBe(false);
		expect(m("admin.other")).toBe(true);
		expect(m("anything.at.any.depth")).toBe(true);
	});

	it("does not disturb existing *, **, ?, {a,b} behavior", () => {
		expect(compilePattern("payments.**")("payments.a.b")).toBe(true);
		expect(compilePattern("admin.*")("admin.x")).toBe(true);
		expect(compilePattern("admin.*")("admin.x.y")).toBe(false);
		expect(compilePattern("admin.??")("admin.ab")).toBe(true);
		expect(compilePattern("{a,b}.x")("b.x")).toBe(true);
		expect(compilePattern("{a,b}.x")("c.x")).toBe(false);
	});
});
