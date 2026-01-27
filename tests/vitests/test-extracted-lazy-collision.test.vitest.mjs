/**
 * Extracted vitest test - exact copy of failing test
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "./setup/vitest-helper.mjs";
import { writeFileSync } from "fs";

// Test with LAZY config only - WITHOUT diagnostics to test theory
const config = { mode: "lazy", runtime: "async", hooks: false, diagnostics: false };

describe("Metadata Collision Modes - LAZY only", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	const materialize = async (api, path, ...args) => {
		const parts = path.split(".");
		let target = api;
		for (let i = 0; i < parts.length - 1; i++) {
			target = target[parts[i]];
		}
		const fn = target[parts[parts.length - 1]];
		try {
			return await fn(...args);
		} catch (_) {
			return await fn(...args);
		}
	};

	it("should handle merge mode - both file and folder functions available", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			collision: { initial: "merge" }
		});

		// Merge mode: BOTH file and folder should be present
		expect(api.math).toBeDefined();

		// File functions (math.mjs)
		expect(typeof api.math.power).toBe("function");
		expect(typeof api.math.sqrt).toBe("function");
		expect(typeof api.math.modulo).toBe("function");

		// Folder functions (math/math.mjs)
		expect(typeof api.math.add).toBe("function");
		expect(typeof api.math.multiply).toBe("function");

		// Verify they actually work
		const powerResult = await materialize(api, "math.power", 2, 3);
		expect(powerResult).toBe(8);
		const addResult = await materialize(api, "math.add", 5, 7);
		expect(addResult).toBe(12);

		// Check system metadata filePath to confirm sources
		const powerMeta = api.math.power.__metadata;
		const addMeta = api.math.add.__metadata;
		expect(powerMeta).toBeDefined();
		expect(addMeta).toBeDefined();

		// Write metadata to file for debugging
		writeFileSync(
			"tmp/metadata-debug.json",
			JSON.stringify(
				{
					power: powerMeta,
					add: addMeta
				},
				null,
				2
			)
		);

		// File functions should have filePath ending in math.mjs
		expect(powerMeta.filePath).toMatch(/[/\\]math\.mjs$/);
		// Folder functions should have filePath with math/math.mjs
		expect(addMeta.filePath).toMatch(/[/\\]math[/\\]math\.mjs$/);
	});
});
