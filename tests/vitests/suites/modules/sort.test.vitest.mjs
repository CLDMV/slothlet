/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/sort.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
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

	it("handles a single-element array (returns a copy)", () => {
		const r = makeResult("only", 7);
		const out = sortModules([r]);
		expect(out).toEqual([r]);
		expect(out).not.toBe([r]); // new array reference
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
		expect(out.map((r) => r.packageName).slice(0, 2).sort()).toEqual(["p1", "p3"]);
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
