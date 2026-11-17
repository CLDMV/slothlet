/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/errors-branches.test.vitest.mjs
 *	@Date: 2026-02-27T08:32:05-08:00 (1772209925)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:23-08:00 (1794882563)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Coverage tests for SlothletError and SlothletWarning uncovered branches
 * (errors.mjs lines 62, 184), exercised entirely through the public slothlet API.
 *
 * @description
 *
 * **Line 62 — static HINT lookup: `translatedHint = staticHint`**
 *
 *   Fires inside the `SlothletError` constructor when:
 *   1. `validationError: true` is passed as a constructor option, AND
 *   2. `HINT_<CODE>` is a real, non-fallback string in the i18n translations.
 *
 *   Trigger path through slothlet:
 *   `slothlet({ base: "" })` → config validation throws `INVALID_CONFIG_DIR_MISSING`
 *   with `{ validationError: true }`.  `HINT_INVALID_CONFIG_DIR_MISSING` exists in
 *   en-us.json as a genuine hint string, so the constructor takes line 62.
 *
 * **Line 184 — `SlothletWarning.captured.push(this)`**
 *
 *   Fires when a `SlothletWarning` is constructed while
 *   `SlothletWarning.suppressConsole === true`.  The global vitest setup sets this
 *   flag to `true` before any test runs, so any warning goes into `captured[]`
 *   instead of printing to the console.
 *
 *   Trigger path through slothlet: `api.slothlet.api.add(path, dir, { collisionMode })` with
 *   `api.collision.override` off creates `WARNING_API_ADD_OPTION_LOCKED` via
 *   `new slothlet.SlothletWarning(...)` (gated behind `if (!config.silent)`).
 *   Because `suppressConsole` is true, line 184 fires: `captured.push(this)`.
 *   NOTE: `silent: true` must NOT be passed here — it suppresses the warning entirely.
 *
 * @module tests/vitests/suites/lifecycle/errors-branches
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── SlothletError static-hint path (line 62) ─────────────────────────────────

describe("SlothletError — static HINT_<CODE> lookup via slothlet config validation (line 62)", () => {
	it("slothlet with a present-but-empty base throws INVALID_CONFIG_DIR_MISSING and the error carries a hint (line 62)", async () => {
		// Config validation checks the base before loading; an empty string triggers INVALID_CONFIG_DIR_MISSING
		// (an absent or null base is a valid no-base instance since #471)
		// with { validationError: true }.  SlothletError constructor retrieves
		// HINT_INVALID_CONFIG_DIR_MISSING from i18n → real string → line 62 fires:
		//   translatedHint = staticHint
		const err = await slothlet({ base: "" }).catch((e) => e);
		expect(err).toBeInstanceOf(Error);
		expect(err.code).toBe("INVALID_CONFIG_DIR_MISSING");
		expect(err.hint).toBeDefined();
		expect(typeof err.hint).toBe("string");
		expect(err.hint.length).toBeGreaterThan(0);
	});

	it("the hint is a real translation, not a fallback 'Error:...' string (line 62)", async () => {
		const err = await slothlet({ base: "" }).catch((e) => e);
		expect(err.hint).not.toMatch(/^Error:/);
	});

	it("slothlet with empty-string dir also throws INVALID_CONFIG_DIR_MISSING with a hint (line 62)", async () => {
		const err = await slothlet({ base: "" }).catch((e) => e);
		expect(err.code).toBe("INVALID_CONFIG_DIR_MISSING");
		expect(err.hint).toBeDefined();
		expect(err.hint).not.toMatch(/^Error:/);
	});
});

// ─── SlothletWarning captured branch (line 184) ───────────────────────────────

describe("SlothletWarning — captured.push via a runtime warning through slothlet (line 184)", () => {
	let api;

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown().catch(() => {});
		}
		api = null;
		// Capture is per instance (#819): nothing to drain on the process-level class.
	});

	/**
	 * Load the base api and pass `api.add()` an option the instance's collision config locks, which raises
	 * `WARNING_API_ADD_OPTION_LOCKED`.
	 * @returns {Promise<object>} The api.
	 */
	const loadAndWarn = async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, diagnostics: true });
		await api.slothlet.api.add("locked", TEST_DIRS.API_TEST_MIXED, { collision: { mode: "replace" } });
		return api;
	};

	it("a locked api.add() option creates a warning captured in captured[] (line 184)", async () => {
		// suppressConsole is true (set globally in vitest.setup.mjs), so the warning is captured.
		// IMPORTANT: do NOT pass silent:true here — it gates the warning creation entirely.
		await loadAndWarn();
		expect(api.slothlet.diag.SlothletWarning.captured.length).toBeGreaterThan(0);
	});

	it("the captured warning has code WARNING_API_ADD_OPTION_LOCKED (line 184)", async () => {
		await loadAndWarn();
		const codes = api.slothlet.diag.SlothletWarning.captured.map((w) => w.code);
		expect(codes).toContain("WARNING_API_ADD_OPTION_LOCKED");
	});
});
