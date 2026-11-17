/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/errors-branches.test.vitest.mjs
 *	@Date: 2026-02-27T08:32:05-08:00 (1772209925)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T22:54:02-08:00 (1794812042)
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
 * **Recording a warning on its instance (`api.slothlet.warnings`)**
 *
 *   Every `SlothletWarning` raised through an instance's class is pushed to that
 *   instance's list, whether or not it reaches the console (the global vitest setup
 *   keeps it off the console).
 *
 *   Trigger path through slothlet:
 *   `slothlet({ dir, allowMutation: false })` — `allowMutation` is a v2 deprecated
 *   config key.  `transformConfig` detects it and creates `V3_CONFIG_DEPRECATED` via
 *   `new this.SlothletWarning(...)` (gated behind `if (!config.silent)`).
 *   Every warning raised through an instance is recorded on it, printed or not.
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

describe("SlothletWarning — recorded on the instance via a deprecated-config warning", () => {
	let api;

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown().catch(() => {});
		}
		api = null;
		// Capture is per instance (#819): nothing to drain on the process-level class.
	});

	it("slothlet with allowMutation:false records a V3_CONFIG_DEPRECATED warning on the instance", async () => {
		// allowMutation is a v2 deprecated key → transformConfig calls new SlothletWarning(...).
		// suppressConsole is true (set globally in vitest.setup.mjs).
		// The warning is recorded on the instance whether or not it is printed.
		// IMPORTANT: do NOT pass silent:true here — it gates the warning creation entirely.
		api = await slothlet({ base: TEST_DIRS.API_TEST, allowMutation: false, diagnostics: true });
		expect(api.slothlet.warnings.get().length).toBeGreaterThan(0);
	});

	it("the captured warning has code V3_CONFIG_DEPRECATED (line 184)", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, allowMutation: false, diagnostics: true });
		const codes = api.slothlet.warnings.get().map((w) => w.code);
		expect(codes).toContain("V3_CONFIG_DEPRECATED");
	});
});
