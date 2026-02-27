/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/lifecycle/errors-branches.test.vitest.mjs
 *      @Date: 2026-02-27T00:00:00-08:00 (1772169600)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-02-27 00:00:00 -08:00 (1772169600)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for SlothletError and SlothletWarning uncovered branches
 * (errors.mjs lines 62, 184).
 *
 * @description
 * Covers two code paths never reached by the existing integration suite:
 *
 * - **Line 62** — `translatedHint = staticHint`: fires inside the `SlothletError`
 *   constructor when `validationError: true` AND the code has a `HINT_<CODE>` entry
 *   in the i18n translations that is a real string (not starting with "Error:").
 *   The OWNERSHIP_INVALID_MODULE_ID and OWNERSHIP_INVALID_API_PATH codes both have
 *   valid hint entries, so throwing those errors with `validationError: true` reaches
 *   line 62.
 *
 * - **Line 184** — `SlothletWarning.captured.push(this)`: fires when a `SlothletWarning`
 *   is constructed while `SlothletWarning.suppressConsole === true`.  The global vitest
 *   setup sets this to `true` before tests run, so any `new SlothletWarning(...)` call
 *   should reach line 184.  This test makes the path explicit to ensure coverage is
 *   attributed to errors.mjs.
 *
 * @module tests/vitests/suites/lifecycle/errors-branches.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

// ─── SlothletError static-hint path (line 62) ─────────────────────────────────

describe("SlothletError constructor — static HINT_<CODE> translation path (line 62)", () => {
	it("constructs without throwing when a validationError code has a HINT_ entry (line 62)", () => {
		// OWNERSHIP_INVALID_MODULE_ID has HINT_OWNERSHIP_INVALID_MODULE_ID in en-us.json.
		// With validationError:true, the constructor checks HINT_OWNERSHIP_INVALID_MODULE_ID
		// and sets translatedHint = staticHint (line 62) when the translation is valid.
		expect(() => {
			new SlothletError("OWNERSHIP_INVALID_MODULE_ID", { moduleID: null }, null, { validationError: true });
		}).not.toThrow();
	});

	it("error message includes the error code for OWNERSHIP_INVALID_MODULE_ID (line 62)", () => {
		const err = new SlothletError("OWNERSHIP_INVALID_MODULE_ID", { moduleID: "bad" }, null, { validationError: true });
		expect(err.message).toMatch(/OWNERSHIP_INVALID_MODULE_ID/);
	});

	it("the hint is set when HINT_<CODE> translation exists and is not an Error: fallback (line 62)", () => {
		// OWNERSHIP_INVALID_API_PATH also has a valid HINT_ entry
		const err = new SlothletError("OWNERSHIP_INVALID_API_PATH", { apiPath: 42 }, null, { validationError: true });
		// hint property should be defined and contain meaningful text
		expect(err.hint).toBeDefined();
		expect(typeof err.hint).toBe("string");
		expect(err.hint).not.toMatch(/^Error:/);
	});

	it("COLLISION_ERROR also has a valid HINT_ and triggers line 62 (line 62)", () => {
		const err = new SlothletError("COLLISION_ERROR", { key: "math", apiPath: "root.math" }, null, { validationError: true });
		expect(err.hint).toBeDefined();
		expect(err.hint).not.toMatch(/^Error:/);
	});
});

// ─── SlothletWarning captured branch (line 184) ───────────────────────────────

describe("SlothletWarning constructor — captured.push path when suppressConsole is true (line 184)", () => {
	let originalSuppress;
	let originalCaptured;

	afterEach(() => {
		// Restore state to not affect other test files
		SlothletWarning.suppressConsole = originalSuppress;
		SlothletWarning.captured = originalCaptured;
	});

	it("pushes warning to captured array when suppressConsole is true (line 184)", () => {
		originalSuppress = SlothletWarning.suppressConsole;
		originalCaptured = [...SlothletWarning.captured];

		SlothletWarning.suppressConsole = true;
		const priorLength = SlothletWarning.captured.length;

		// Creating a warning with suppressConsole=true routes to line 184 (captured.push)
		new SlothletWarning("V2_CONFIG_UNSUPPORTED", {
			option: "allowMutation",
			replacement: "api.mutations",
			hint: "test"
		});

		expect(SlothletWarning.captured.length).toBe(priorLength + 1);
		expect(SlothletWarning.captured[SlothletWarning.captured.length - 1]).toBeInstanceOf(SlothletWarning);
	});

	it("captured item has the correct code when suppressConsole is true (line 184)", () => {
		originalSuppress = SlothletWarning.suppressConsole;
		originalCaptured = [...SlothletWarning.captured];

		SlothletWarning.suppressConsole = true;
		SlothletWarning.captured = [];

		new SlothletWarning("V2_CONFIG_UNSUPPORTED", { option: "test", replacement: "r", hint: "h" });

		expect(SlothletWarning.captured.length).toBe(1);
		expect(SlothletWarning.captured[0].code).toBe("V2_CONFIG_UNSUPPORTED");
	});
});
