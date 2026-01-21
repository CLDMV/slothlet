/**
 * @fileoverview Tests for backgroundMaterialize config option
 * @module background-materialize.test.vitest
 *
 * @description
 * Tests that backgroundMaterialize config option properly materializes lazy mode
 * wrappers on creation, allowing accurate typeof checks for object exports.
 */

import { describe, test, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_MATRIX, API_TEST_BASE } from "../../setup/vitest-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe.each(TEST_MATRIX.filter((config) => config.config.mode === "lazy"))("Background Materialize - %s", ({ name, config }) => {
	test("backgroundMaterialize: false - typeof returns function before access", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_single`),
			backgroundMaterialize: false // Explicit false
		});

		// In lazy mode without backgroundMaterialize, typeof returns "function" (proxy target)
		expect(typeof api.config).toBe("function");

		await api.shutdown();
	});

	test("backgroundMaterialize: true - typeof returns object immediately", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_single`),
			backgroundMaterialize: true // Enable background materialization
		});

		// With backgroundMaterialize, typeof should return "object" immediately
		// because materialization happened during proxy creation
		expect(typeof api.config).toBe("object");

		// Verify the wrapper actually works and has the expected functions
		expect(typeof api.config.getConfig).toBe("function");
		const result = await api.config.getConfig();
		expect(result).toBe("config-value");

		await api.shutdown();
	});

	test("backgroundMaterialize: true - works with nested objects", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`),
			backgroundMaterialize: true
		});

		// Check that nested objects also get correct typeof
		expect(typeof api.math).toBe("object");
		expect(typeof api.math.add).toBe("function");

		// Verify functionality
		const result = await api.math.add(2, 3);
		expect(result).toBe(5);

		await api.shutdown();
	});
});
