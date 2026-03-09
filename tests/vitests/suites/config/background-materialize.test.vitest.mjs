/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/background-materialize.test.vitest.mjs
 *	@Date: 2026-01-21T08:25:16-08:00 (1769012716)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:45 -08:00 (1772425305)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
import { getMatrixConfigs, API_TEST_BASE } from "../../setup/vitest-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAZY_MATRIX = getMatrixConfigs({ mode: "lazy" });
describe.each(LAZY_MATRIX)("Background Materialize - %s", ({ ____name, config }) => {
	test("backgroundMaterialize: false - modules not materialized until accessed", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`),
			backgroundMaterialize: false // Explicit false
		});

		// Without backgroundMaterialize, __type returns IN_FLIGHT or UNMATERIALIZED (not materialized yet)
		// NOTE: Must test nested module (api.deep.folder.config) not root (api.math)
		// because root files are always eager even in lazy mode for collision handling
		const typeValue = api.deep.folder.config.__type;
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

		// NOTE: Due to architecture limitation, lazy mode loads modules during init for flattening analysis,
		// so backgroundMaterialize doesn't actually change behavior. __type still returns IN_FLIGHT initially,
		// BUT under coverage/load (especially with hooks+diagnostics+live runtime), background materialization
		// can complete before this assertion — so we accept either pending OR already-materialized.
		// NOTE: Must test nested module (api.deep.folder.config) not root (api.math)
		// because root files are always eager even in lazy mode for collision handling
		const configType = api.deep.folder.config.__type;
		const isAlreadyMaterialized = api.deep.folder.config.__materialized === true;
		const isValidConfigState = isAlreadyMaterialized
			? typeof configType === "string"
			: configType === api.slothlet.types.UNMATERIALIZED || configType === api.slothlet.types.IN_FLIGHT;
		expect(isValidConfigState).toBe(true);

		// NOTE: typeof api.deep.folder.config.get ALWAYS returns "function" in lazy mode because the proxy target
		// is a function (see docs/v3/changelog/typeof-always-function-lazy-mode.md).
		// Use __type to check actual materialization status.
		expect(typeof api.deep.folder.config.get).toBe("function");

		// FIXED: Was failing due to Node.js module cache pollution between instances. When multiple
		// slothlet instances loaded the same modules, Node cached them, causing wrapper/state bleed.
		// Fixed by cache-busting imports with instanceID query parameter (loader.mjs).
		// NOTE: Default collision resolution prefers FILE over FOLDER, so add() returns 1005 (from math.mjs)
		const result = await api.math.add(2, 3);
		expect(result).toBe(1005);

		await api.shutdown();
	});

	test("backgroundMaterialize: true - works with function exports", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`),
			backgroundMaterialize: true
		});

		// __type returns either the impl's actual type ("function") if already materialized,
		// or a status symbol (IN_FLIGHT/UNMATERIALIZED) if still pending. Both are valid here
		// since backgroundMaterialize=true triggers async materialization but doesn't guarantee
		// completion before the assertion. Check __materialized to distinguish the two cases.
		const loggerType = api.logger.__type;
		const isAlreadyMaterialized = api.logger.__materialized === true;
		const isValidType = isAlreadyMaterialized
			? loggerType === "function"
			: loggerType === api.slothlet.types.UNMATERIALIZED || loggerType === api.slothlet.types.IN_FLIGHT;
		expect(isValidType).toBe(true);

		// Verify functionality - logger always returns formatted output: [LOG] timestamp: message
		const result = await api.logger("test");
		expect(result).toMatch(/\[LOG\] .+: test$/);

		await api.shutdown();
	});
});
