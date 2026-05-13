/**
 * @fileoverview Coverage for loader.mjs #buildTypescriptModuleUrl branches:
 *   - `if (moduleID) moduleUrl += "&module=…"` true branch
 *   - `if (cacheBust) moduleUrl += "&_reload=…"` true branch
 *
 * Both branches need a TS load that propagates these arguments through:
 *   moduleID — supplied by `api.slothlet.api.add(..., { moduleID })`
 *   cacheBust — set to `Date.now()` by the cache-rebuild path that runs during
 *   `api.slothlet.api.reload(apiPath)`.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";

describe("loader.mjs #buildTypescriptModuleUrl coverage", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("exercises both moduleID and cacheBust true/false arms in one process", async () => {
		// Combined into a single `it` block so v8 records branch hits for both
		// arms of `if (moduleID)` and `if (cacheBust)` in the same coverage
		// snapshot — splitting across multiple `it` blocks sometimes drops
		// branch counts during full-suite coverage merge.

		// 1) Initial TS load → loadModule receives moduleID=null, cacheBust=null,
		//    hitting the FALSE arms of both `if`s in #buildTypescriptModuleUrl.
		api = await slothlet({
			dir: "./api_tests/api_test_typescript",
			typescript: true
		});
		expect(api.math.add(1, 2)).toBe(3);

		// 2) api.add(..., { moduleID }) → loadModule receives a truthy moduleID,
		//    hitting the TRUE arm of `if (moduleID)`.
		await api.slothlet.api.add("tsAdded", "./api_tests/api_test_typescript", {
			moduleID: "ts-cov-moduleid"
		});
		expect(api.tsAdded.math.add(2, 3)).toBe(5);

		// 3) api.reload(apiPath) → cache rebuild calls buildAPI with
		//    `cacheBust: Date.now()` → loadModule receives a truthy cacheBust,
		//    hitting the TRUE arm of `if (cacheBust)`.
		await api.slothlet.api.reload("tsAdded");
		expect(api.tsAdded.math.add(4, 5)).toBe(9);
	});
});
