/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/errors-warning-context.test.vitest.mjs
 *	@Date: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 16:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for SlothletWarning console output false branch (line 184).
 *
 * @description
 * The SlothletWarning constructor has:
 *   ```javascript
 *   if (!SlothletWarning.suppressConsole) {
 *       console.warn(`...`);
 *       if (Object.keys(contextData).length > 0) {  // ← line 184
 *           console.warn("Context:", contextData);   // ← line 184 TRUE branch (already covered)
 *       }
 *       // ← line 184 FALSE branch: contextData is empty {}
 *   }
 *   ```
 * The FALSE branch of line 184 fires when the warning is emitted to console
 * (suppressConsole=false) but the context has no keys (empty `contextData`).
 *
 * The `contextData` is the result of `{ key: msgKey, ...contextData } = context`,
 * meaning if `context = {}` then `contextData = {}` (empty) → length 0 → false branch.
 *
 * Warning: This test temporarily disables `suppressConsole` and spies on `console.warn`
 * to prevent actual console output while hitting the uncovered path.
 *
 * @module tests/vitests/suites/core/errors-warning-context
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, vi, afterEach } from "vitest";
import { SlothletWarning } from "@cldmv/slothlet/errors";

afterEach(() => {
	// Always restore suppressConsole after each test regardless of outcome
	SlothletWarning.suppressConsole = true;
	SlothletWarning.captured = [];
	vi.restoreAllMocks();
});

// ─── SlothletWarning — empty context (line 184 false branch) ─────────────────

describe("SlothletWarning — empty contextData skips context log (line 184 false branch)", () => {
	it("emits warning but skips context console.warn when context is empty (line 184 false)", () => {
		// Spy on console.warn BEFORE disabling suppressConsole
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// Enable console output (suppressConsole=false) so the outer if is entered
		SlothletWarning.suppressConsole = false;

		// context = {} → contextData = {} → Object.keys({}).length === 0 → false branch at line 184
		new SlothletWarning("WARNING_METADATA_MISMATCH", {});

		// The outer console.warn (header line) must have been called
		expect(warnSpy).toHaveBeenCalled();

		// Find header call — it should be the `⚠️` message
		const warnCalls = warnSpy.mock.calls;
		const headerCall = warnCalls.find((call) => String(call[0]).includes("⚠️"));
		expect(headerCall).toBeDefined();

		// The "Context:" call must NOT have been made (false branch — no context to log)
		const contextCall = warnCalls.find((call) => call[0] === "Context:");
		expect(contextCall).toBeUndefined();
	});

	it("emits warning AND context console.warn when context has keys (line 184 true, control)", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		SlothletWarning.suppressConsole = false;

		// context has extra key → contextData = { source: "test" } → length 1 → true branch at line 184
		new SlothletWarning("WARNING_METADATA_MISMATCH", { source: "test" });

		const warnCalls = warnSpy.mock.calls;
		const contextCall = warnCalls.find((call) => call[0] === "Context:");
		// The Context log SHOULD be present (length > 0 → true branch taken)
		expect(contextCall).toBeDefined();
	});

	it("does NOT emit console.warn at all when suppressConsole=true (confirming outer branch)", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// suppressConsole=true by default — the entire outer if is skipped
		SlothletWarning.suppressConsole = true;
		new SlothletWarning("WARNING_METADATA_MISMATCH", {});

		// No console output — captured array used instead
		expect(warnSpy).not.toHaveBeenCalled();
		expect(SlothletWarning.captured.length).toBeGreaterThan(0);
	});
});
