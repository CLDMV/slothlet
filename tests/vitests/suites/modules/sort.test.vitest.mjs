/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/sort.test.vitest.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 18:57:26 -07:00 (1779933446)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for the pure sortModules() function.
 * @module tests/vitests/suites/modules/sort
 */

import { describe, it, expect } from "vitest";
import { sortModules } from "../../../../src/lib/helpers/module-sort.mjs";

function makeResult(packageName, priority, mountPath = ["x"]) {
	return Object.freeze({
		packageName,
		packageRoot: `/fake/${packageName}`,
		mountPath: Object.freeze(mountPath),
		apiDir: `/fake/${packageName}/api`,
		manifest: Object.freeze({ priority, name: packageName, mountPath })
	});
}

// ─── Default comparator ──────────────────────────────────────────────────────

describe("sortModules — default comparator", () => {
	it("sorts by priority descending (higher first)", () => {
		const input = [makeResult("a", 10), makeResult("b", 50), makeResult("c", 20)];
		const out = sortModules(input);
		expect(out.map((r) => r.packageName)).toEqual(["b", "c", "a"]);
	});

	it("breaks priority ties by packageName ascending", () => {
		const input = [makeResult("@org/zeta", 100), makeResult("@org/alpha", 100), makeResult("@org/mu", 100)];
		const out = sortModules(input);
		expect(out.map((r) => r.packageName)).toEqual(["@org/alpha", "@org/mu", "@org/zeta"]);
	});

	it("treats missing priority as 0", () => {
		const input = [
			Object.freeze({ packageName: "explicit", manifest: Object.freeze({ priority: 5 }) }),
			Object.freeze({ packageName: "missing", manifest: Object.freeze({}) })
		];
		const out = sortModules(input);
		expect(out.map((r) => r.packageName)).toEqual(["explicit", "missing"]);
	});

	it("places negative priorities below zero-priority", () => {
		const input = [makeResult("neg", -1), makeResult("zero", 0), makeResult("pos", 1)];
		const out = sortModules(input);
		expect(out.map((r) => r.packageName)).toEqual(["pos", "zero", "neg"]);
	});

	it("handles an empty input array", () => {
		expect(sortModules([])).toEqual([]);
	});

	it("returns 0 when two modules have identical priority and identical packageName (line 87-88 equal-name fallthrough)", () => {
		// Same priority + same packageName forces the comparator past the
		// `na < nb` and `na > nb` checks into the final `return 0`.
		const a = { packageName: "@org/twin", manifest: { priority: 1 } };
		const b = { packageName: "@org/twin", manifest: { priority: 1 } };
		const out = sortModules([a, b]);
		expect(out).toHaveLength(2);
		// Both inputs are present (order between equal entries is implementation-defined).
		expect(out.map((x) => x.packageName).sort()).toEqual(["@org/twin", "@org/twin"]);
	});

	it("handles a single-element array (returns a copy)", () => {
		const r = makeResult("only", 7);
		const input = [r];
		const out = sortModules(input);
		expect(out).toEqual(input);
		expect(out).not.toBe(input); // new array reference, not the same one we passed in
	});
});

// ─── Purity / no mutation ───────────────────────────────────────────────────

describe("sortModules — purity", () => {
	it("does not mutate the input array", () => {
		const input = [makeResult("a", 10), makeResult("b", 50), makeResult("c", 20)];
		const before = input.map((r) => r.packageName);
		sortModules(input);
		expect(input.map((r) => r.packageName)).toEqual(before);
	});

	it("returns a new array reference", () => {
		const input = [makeResult("a", 1)];
		const out = sortModules(input);
		expect(out).not.toBe(input);
	});
});

// ─── Custom comparator ──────────────────────────────────────────────────────

describe("sortModules — custom comparator", () => {
	it("uses a provided comparator instead of the default", () => {
		const input = [makeResult("z", 100), makeResult("a", 1), makeResult("m", 50)];
		const out = sortModules(input, (x, y) => x.packageName.localeCompare(y.packageName));
		expect(out.map((r) => r.packageName)).toEqual(["a", "m", "z"]);
	});

	it("supports a reverse-priority comparator", () => {
		const input = [makeResult("a", 1), makeResult("b", 100), makeResult("c", 50)];
		const out = sortModules(input, (x, y) => (x.manifest.priority ?? 0) - (y.manifest.priority ?? 0));
		expect(out.map((r) => r.packageName)).toEqual(["a", "c", "b"]);
	});

	it("supports a comparator that reads arbitrary manifest fields", () => {
		const input = [
			Object.freeze({ packageName: "p1", manifest: Object.freeze({ kind: "driver" }) }),
			Object.freeze({ packageName: "p2", manifest: Object.freeze({ kind: "extension" }) }),
			Object.freeze({ packageName: "p3", manifest: Object.freeze({ kind: "driver" }) })
		];
		const out = sortModules(input, (x, y) => x.manifest.kind.localeCompare(y.manifest.kind));
		expect(
			out
				.map((r) => r.packageName)
				.slice(0, 2)
				.sort()
		).toEqual(["p1", "p3"]);
		expect(out[2].packageName).toBe("p2");
	});

	it("falls back to the default comparator when the supplied comparator is not a function", () => {
		const input = [makeResult("a", 10), makeResult("b", 50)];
		const out = sortModules(input, /** @type {any} */ ("not-a-fn"));
		expect(out.map((r) => r.packageName)).toEqual(["b", "a"]); // default order
	});
});

// ─── Default-comparator robustness ──────────────────────────────────────────

describe("sortModules — default comparator robustness", () => {
	it("treats a missing manifest as priority 0", () => {
		const input = [
			Object.freeze({ packageName: "with-manifest", manifest: Object.freeze({ priority: 10 }) }),
			Object.freeze({ packageName: "no-manifest" }) // no manifest at all
		];
		const out = sortModules(input);
		expect(out.map((r) => r.packageName)).toEqual(["with-manifest", "no-manifest"]);
	});

	it("treats a missing packageName as empty string for tiebreak", () => {
		const input = [
			Object.freeze({ packageName: "z", manifest: Object.freeze({ priority: 5 }) }),
			Object.freeze({ manifest: Object.freeze({ priority: 5 }) })
		];
		const out = sortModules(input);
		// Empty-string tiebreak should come before "z".
		expect(out[0].packageName).toBeUndefined();
		expect(out[1].packageName).toBe("z");
	});
});

// ─── Deterministic tiebreak (host-independent) ───────────────────────────────

describe("sortModules — deterministic tiebreak across hosts", () => {
	// Regression: the default comparator's packageName tiebreak previously
	// used `String.prototype.localeCompare()` without an explicit locale or
	// options. That delegated to the host's ICU/collation defaults, so the
	// same input could sort differently on different hosts (Node bundled-
	// vs system-ICU, different OS default locales, etc.) — directly
	// contradicting the documented "stable, deterministic tiebreak".
	//
	// The fix uses straight `<`/`>` string comparison, which is fully
	// deterministic in JavaScript (codepoint comparison, host-independent).
	// These tests pin inputs where codepoint and a typical ICU collation
	// produce DIFFERENT outputs so any regression to locale-based ordering
	// fails loudly here.

	it("mixed-case packageNames tiebreak by codepoint (uppercase before lowercase)", () => {
		// Codepoint:        'B' (0x42) < 'a' (0x61)         → ["Banana", "apple"]
		// localeCompare en-US default (case-insensitive primary):
		//                   "apple" < "Banana"              → ["apple", "Banana"]
		// The codepoint order is the deterministic one — assert it.
		const input = [makeResult("apple", 0), makeResult("Banana", 0)];
		const out = sortModules(input);
		expect(out.map((r) => r.packageName)).toEqual(["Banana", "apple"]);
	});

	it("scoped vs unscoped packageNames tiebreak by codepoint (`@` < letters)", () => {
		// Codepoint:        '@' (0x40) < 'z' (0x7A)         → ["@scope/x", "zoo"]
		// localeCompare (most ICU defaults treat `@` as punctuation, ignoring
		//   it at primary level): "@scope/x" → "scope/x" comparison →
		//                          "scope/x" < "zoo" → matches by accident,
		//   BUT under different ICU configurations punctuation handling
		//   varies. Pin the codepoint outcome explicitly.
		const input = [makeResult("zoo", 0), makeResult("@scope/x", 0)];
		const out = sortModules(input);
		expect(out.map((r) => r.packageName)).toEqual(["@scope/x", "zoo"]);
	});

	it("same input sorted independently produces identical output (idempotent on every host)", () => {
		// The deterministic guarantee implies stable repeat sort. Run the
		// same input twice and compare — any non-determinism in the
		// comparator would fail this stability check.
		const input = [makeResult("Foo", 0), makeResult("bar", 0), makeResult("@a/baz", 0), makeResult("BAR", 0)];
		const out1 = sortModules(input);
		const out2 = sortModules(input);
		expect(out1.map((r) => r.packageName)).toEqual(out2.map((r) => r.packageName));
		// Also pin the exact codepoint order — '@' < 'B' < 'F' < 'b'.
		expect(out1.map((r) => r.packageName)).toEqual(["@a/baz", "BAR", "Foo", "bar"]);
	});
});
