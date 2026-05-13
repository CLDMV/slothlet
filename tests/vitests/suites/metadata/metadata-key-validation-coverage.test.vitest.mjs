/**
 * @fileoverview Coverage for prototype-pollution guards in metadata.mjs:
 *   - #assertSafeMetadataKeySegment early return for non-string / empty-string keys
 *   - #assertSafeMetadataKeySegment throw for dot-notation segments matching
 *     `__proto__` / `prototype` / `constructor`
 *   - #assertNoReservedMetadataKeys recursive `walk()` ternary true arm
 *     (nested-object path, depth ≥ 2)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEST_DIRS, materialize, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";
import slothlet from "../../../../index.mjs";

describe("metadata.mjs key-validation coverage", () => {
	let api;

	beforeAll(async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST });
		await materialize(api, "rootMath.add", 1, 2);
	});

	afterAll(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("set silently accepts an empty-string key (length-zero early return)", () => {
		// metadata.set hits setUserMetadata → #mergeMetadataValue → #assertSafeMetadataKeySegment("")
		// where typeof "" === "string" && "".length === 0 → early return, no throw.
		// (metadata.setGlobal does pre-validation in api_builder.mjs and would throw before reaching this branch.)
		expect(() => api.slothlet.metadata.set(api.rootMath.add, "", "ignored")).not.toThrow();
	});

	it("set throws INVALID_METADATA_KEY when a dot-segment is __proto__", () => {
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => {
				api.slothlet.metadata.set(api.rootMath.add, "outer.__proto__.inner", "anything");
			}).toThrow(/INVALID_METADATA_KEY/);
		});
	});

	it("set throws INVALID_METADATA_KEY for a deeply-nested object containing __proto__ (walk depth ≥ 2)", () => {
		// First do a deep but clean set so the assertNoReservedMetadataKeys walk
		// recurses past depth 1 — this hits the line-177 ternary's `path ? ... : key`
		// true arm during the inner walk call.
		expect(() => {
			api.slothlet.metadata.set(api.rootMath.add, "deepClean", { a: { b: { c: 1 } } });
		}).not.toThrow();

		// Then trigger the actual throw with a __proto__ buried two levels deep
		// so the walk has to recurse before noticing the violation. Built via
		// JSON.parse — object-literal syntax treats `__proto__` as a Proto
		// setter rather than an own property, so JSON.parse is the only way to
		// produce an own `__proto__` key from source.
		const tainted = JSON.parse('{"a":{"b":{"__proto__":"tainted"}}}');
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => {
				api.slothlet.metadata.set(api.rootMath.add, "deepBad", tainted);
			}).toThrow(/INVALID_METADATA_KEY/);
		});
	});
});
