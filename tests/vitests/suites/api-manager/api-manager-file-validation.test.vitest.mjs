/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-file-validation.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:16:17 -08:00 (1772313377)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for api-manager file/path validation and debug mode code paths.
 *
 * @description
 * Covers the uncovered branches in api-manager.mjs:
 * 1. `INVALID_CONFIG_FILE_TYPE` (lines 1104-1109): adding a file with an unsupported extension
 * 2. `debug.api = true` syncWrapper debug blocks (lines 413-699): triggered when resolving
 *    collisions between existing and new API trees with debug logging enabled.
 *
 * @module tests/vitests/suites/api-manager/api-manager-file-validation.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, suppressSlothletDebugOutput, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_TXT_FILE = path.resolve(__dirname, "../../../../api_tests/fixture-text.txt");
let restoreDebugOutput;

beforeEach(() => {
	restoreDebugOutput = suppressSlothletDebugOutput();
});

afterEach(() => {
	restoreDebugOutput?.();
	restoreDebugOutput = undefined;
});

/**
 * Create a slothlet API instance for a given configuration.
 * @param {object} baseConfig - Base configuration from the matrix.
 * @param {object} [overrides] - Additional overrides for the slothlet config.
 * @returns {Promise<object>} Initialized slothlet API instance.
 */
async function createApiInstance(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, ...overrides });
}

describe.each(getMatrixConfigs())("API Manager File Validation > Config: '$name'", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	// ─── File extension validation ───────────────────────────────────────────────

	describe("Unsupported file extension (INVALID_CONFIG_FILE_TYPE)", () => {
		it("should reject adding a .txt file (unsupported extension)", async () => {
			api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add("extra", FIXTURE_TXT_FILE)).rejects.toThrow("INVALID_CONFIG_FILE_TYPE");
			});
		});
	});
});

// ─── Debug mode: syncWrapper code paths ──────────────────────────────────────
// Eager-only: lazy mode triggers background materialization that races with shutdown,
// causing unhandled rejections. Debug logging behavior is config-agnostic.

describe.each(getMatrixConfigs({ mode: "eager" }))("API Manager File Validation (debug.api) > Config: '$name'", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	describe("debug.api = true: syncWrapper debug blocks", () => {
		it("should execute debug logging during API reconciliation when debug.api=true", async () => {
			// Create with debug.api = true — covers debug blocks in syncWrapper and mutateApiValue
			api = await createApiInstance(config, {
				dir: TEST_DIRS.API_TEST,
				allowMutation: true,
				debug: { api: true }
			});

			// Adding the same directory again triggers mutateApiValue → syncWrapper,
			// hitting the debug logging blocks at lines 413-699.
			await expect(api.slothlet.api.add("", TEST_DIRS.API_TEST)).resolves.toBeDefined();
		});

		it("should execute debug logging for addition at a nested namespace when debug.api=true", async () => {
			api = await createApiInstance(config, {
				dir: TEST_DIRS.API_TEST_MIXED,
				allowMutation: true,
				debug: { api: true }
			});

			// Reloading a path with debug.api = true triggers syncWrapper with debug logging.
			// Uses a simple path from API_TEST_MIXED which has mathEsm, mathCjs etc.
			await expect(api.slothlet.api.reload("mathEsm.add")).resolves.toBeUndefined();
		});
	});
});
