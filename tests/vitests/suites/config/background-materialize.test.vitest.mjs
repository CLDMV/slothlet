/**
 * @fileoverview Tests for backgroundMaterialize config option
 * @module background-materialize.test.vitest
 *
 * @description
 * Tests that backgroundMaterialize config option properly materializes lazy mode
 * wrappers on creation. Uses __type property to check actual impl type (not proxy target).
 */

import { describe, test, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_MATRIX, API_TEST_BASE } from "../../setup/vitest-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe.each(TEST_MATRIX.filter((config) => config.config.mode === "lazy"))("Background Materialize - %s", ({ name, config }) => {
	test("backgroundMaterialize: false - modules not materialized until accessed", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`),
			backgroundMaterialize: false // Explicit false
		});

		// Without backgroundMaterialize, __type returns IN_FLIGHT or UNMATERIALIZED (not materialized yet)
		const typeValue = api.math.__type;
		const isNotMaterialized = typeValue === api.slothlet.types.UNMATERIALIZED || typeValue === api.slothlet.types.IN_FLIGHT;
		expect(isNotMaterialized).toBe(true);

		await api.shutdown();
	});

	test("backgroundMaterialize: true - __type returns correct type immediately", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`),
			backgroundMaterialize: true // Enable background materialization
		});

		// With backgroundMaterialize, __type should return correct type immediately
		// because materialization happened during proxy creation
		expect(api.math.__type).toBe("object");

		// Verify the wrapper actually works and has the expected functions
		expect(typeof api.math.add).toBe("function");
		const result = await api.math.add(2, 3);
		expect(result).toBe(5);

		await api.shutdown();
	});

	test("backgroundMaterialize: true - works with function exports", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`),
			backgroundMaterialize: true
		});

		// Check that function exports return "function" for __type
		expect(api.logger.__type).toBe("function");

		// Verify functionality
		const result = await api.logger("test");
		expect(result).toBe("test");

		await api.shutdown();
	});
});
