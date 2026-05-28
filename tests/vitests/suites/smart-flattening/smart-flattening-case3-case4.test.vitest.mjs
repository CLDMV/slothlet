/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-case3-case4.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:55 -08:00 (1772425315)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Smart flattening tests - Case 3 (Multiple files) and Case 4 (No flattening).
 * @module smart-flattening-case3-case4.test.vitest
 *
 * @description
 * Tests Cases 3-4:
 * - Case 3: Multiple files with one matching API path (flatten matching, preserve others)
 * - Case 4: Normal behavior when no flattening should occur
 */

import { describe, test, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMatrixConfigs, API_TEST_BASE } from "../../setup/vitest-helper.mjs";

const FULL_MATRIX = getMatrixConfigs({});

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

/**
 * Helper function to trigger materialization in lazy mode
 */
async function materialize(func, ...args) {
	if (typeof func === "function") {
		await func(...args);
	}
}

describe.each(FULL_MATRIX)("Smart Flattening Case 3-4 - $name", ({ name: ___name, config }) => {
	// ========================================================================
	// CASE 3: MULTIPLE FILES WITH ONE MATCHING API PATH
	// ========================================================================

	test("Multiple files with matching API path - autoFlatten=true", async () => {
		const api = await slothlet({
			...config,
			base: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		await api.slothlet.api.add("utils", path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_multiple`), {});

		// Should flatten utils.mjs contents to root level
		expect(typeof api.utils.utilFunction).toBe("function");
		expect(typeof api.utils.helperMethod).toBe("function");
		expect(typeof api.utils.formatData).toBe("function");

		// Should preserve other modules
		expect(typeof api.utils.validator).toBe("object");
		expect(typeof api.utils.logger).toBe("object");
		expect(typeof api.utils.validator.validate).toBe("function");
		expect(typeof api.utils.logger.debug).toBe("function");

		// Should NOT have nested utils.utils
		expect(api.utils.utils).toBeUndefined();

		// Test function execution
		await materialize(api.utils.utilFunction);
		const result = await api.utils.utilFunction();
		expect(result).toBe("utility function");

		await api.shutdown();
	});

	test("Multiple files with matching API path - autoFlatten=false", async () => {
		const api = await slothlet({
			...config,
			base: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		await api.slothlet.api.add("utils", path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_multiple`), {});

		// Should flatten utils.mjs due to Rule 7 (always applies)
		expect(typeof api.utils.utilFunction).toBe("function");
		expect(api.utils.utils).toBeUndefined();

		// Should still preserve other modules
		expect(typeof api.utils.validator).toBe("object");
		expect(typeof api.utils.logger).toBe("object");

		await api.shutdown();
	});

	// ========================================================================
	// CASE 4: NO FLATTENING - NORMAL BEHAVIOR
	// ========================================================================

	test("No matching files - normal behavior autoFlatten=true", async () => {
		const api = await slothlet({
			...config,
			base: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		await api.slothlet.api.add("services", path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_none`), {});

		// Should NOT flatten since no files match "services"
		expect(typeof api.services.auth).toBe("object");
		expect(typeof api.services.users).toBe("object");
		expect(typeof api.services.auth.authenticate).toBe("function");
		expect(typeof api.services.users.getUser).toBe("function");

		// Should NOT have flattening
		expect(api.services.authenticate).toBeUndefined();

		await api.shutdown();
	});

	test("No matching files - normal behavior autoFlatten=false", async () => {
		const api = await slothlet({
			...config,
			base: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		await api.slothlet.api.add("services", path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_none`), {});

		// Should behave same as autoFlatten=true when no files match
		expect(typeof api.services.auth).toBe("object");
		expect(typeof api.services.users).toBe("object");

		await api.shutdown();
	});
});

// ============================================================================
// RULE 5: MULTI-DEFAULT (C02/C03) — integration tests
// C02: files WITH a default export → preserved as named namespace
// C03: files WITHOUT a default export → named exports hoisted into parent namespace
// ============================================================================

const MULTI_DEFAULT_DIR = path.join(__dirname, "../../../../api_tests/api_test_multi_default");

describe.each(FULL_MATRIX)("Smart Flattening Rule 5 multi-default (C02/C03) - $name", ({ name: ___name, config }) => {
	test("C02: default-exporting files are accessible as named namespaces on the folder", async () => {
		const api = await slothlet({ ...config, base: MULTI_DEFAULT_DIR });

		// email.mjs has a default export → preserved as api.notifications.email(...)
		expect(typeof api.notifications.email).toBe("function");
		const result = await api.notifications.email("a@x.com", "hello");
		expect(result.sent).toBe(true);
		expect(result.via).toBe("email");

		// sms.mjs has a default export → preserved as api.notifications.sms(...)
		expect(typeof api.notifications.sms).toBe("function");
		const smsResult = await api.notifications.sms("+15555555555", "hi");
		expect(smsResult.sent).toBe(true);
		expect(smsResult.via).toBe("sms");

		await api.shutdown();
	});

	test("C03: named-only file exports are hoisted directly into the parent folder namespace", async () => {
		const api = await slothlet({ ...config, base: MULTI_DEFAULT_DIR });

		// helpers.mjs has NO default — its exports should appear at api.notifications level
		expect(typeof api.notifications.formatPhone).toBe("function");
		expect(await api.notifications.formatPhone("5555555555")).toBe("+15555555555");

		expect(api.notifications.RETRY_LIMIT).toBe(3);

		await api.shutdown();
	});

	test("C03: the no-default file does NOT create its own intermediate namespace", async () => {
		const api = await slothlet({ ...config, base: MULTI_DEFAULT_DIR });

		// Access a known hoisted property first to trigger lazy materialization of api.notifications
		await api.notifications.formatPhone("5555555555");

		// After materialization, helpers namespace must not exist — exports were dissolved into api.notifications
		expect(api.notifications.helpers).toBeUndefined();

		await api.shutdown();
	});
});
