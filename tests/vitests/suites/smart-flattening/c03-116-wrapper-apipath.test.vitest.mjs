/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/c03-116-wrapper-apipath.test.vitest.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Failing test for C03_116 wrapper apiPath mismatch.
 *
 * @description
 * The hoist path in modes-processor.mjs for C03_116 (Rule 5, no-default file in a
 * multi-default folder) computes the wrapper's apiPath using
 *   `apiPathPrefix ? apiPathPrefix + "." : ""` + key
 * while ownership at the same site uses
 *   `apiPathPrefix ? apiPathPrefix + "." + key : categoryName + "." + key`.
 *
 * When `!isRoot && !apiPathPrefix` — the case for a top-level multi-default folder
 * like `notifications/helpers.mjs` — the wrapper ends up with apiPath="formatPhone"
 * while ownership registers "notifications.formatPhone". Anything that consults the
 * wrapper's apiPath (hooks, permissions, metadata, debug output) sees the wrong
 * path. The existing C03 integration tests assert callability but never inspect
 * the wrapper's apiPath, so this slips through.
 *
 * @module tests/vitests/suites/smart-flattening/c03-116-wrapper-apipath
 */

import { describe, test, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

const MULTI_DEFAULT_DIR = path.join(__dirname, "../../../../api_tests/api_test_multi_default");

const HOOK_MATRIX = getMatrixConfigs({ hook: { enabled: true } });

// ─── metadata-level proof ────────────────────────────────────────────────────

describe.each(HOOK_MATRIX)("C03_116 wrapper apiPath - $name", ({ config }) => {
	test("hoisted formatPhone wrapper exposes apiPath 'notifications.formatPhone'", async () => {
		const api = await slothlet({ ...config, base: MULTI_DEFAULT_DIR });

		// Trigger lazy materialization (no-op in eager mode)
		await api.notifications.formatPhone("5555555555");

		const meta = await api.slothlet.metadata.get("notifications.formatPhone");

		expect(meta).not.toBeNull();
		expect(meta.apiPath).toBe("notifications.formatPhone");

		await api.shutdown();
	});

	test("notifications.formatPhone:before hook fires when calling api.notifications.formatPhone", async () => {
		const api = await slothlet({ ...config, base: MULTI_DEFAULT_DIR });

		let fired = false;
		api.slothlet.hook.on(
			"notifications.formatPhone:before",
			() => {
				fired = true;
			},
			{ id: "c03-116-hook" }
		);

		await api.notifications.formatPhone("5555555555");

		expect(fired).toBe(true);

		await api.shutdown();
	});
});
