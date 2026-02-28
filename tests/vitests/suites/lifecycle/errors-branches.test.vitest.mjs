/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/errors-branches.test.vitest.mjs
 *	@Date: 2026-02-27T08:32:05-08:00 (1772209925)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:23:04 -08:00 (1772313784)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
 *   `slothlet({ dir: null })` → config validation throws `INVALID_CONFIG_DIR_MISSING`
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
 *   Trigger path through slothlet:
 *   `slothlet({ dir, allowMutation: false })` — `allowMutation` is a v2 deprecated
 *   config key.  `transformConfig` detects it and creates `V2_CONFIG_UNSUPPORTED` via
 *   `new this.SlothletWarning(...)` (gated behind `if (!config.silent)`).
 *   Because `suppressConsole` is true, line 184 fires: `captured.push(this)`.
 *   NOTE: `silent: true` must NOT be passed here — it suppresses the warning entirely.
 *
 * @module tests/vitests/suites/lifecycle/errors-branches
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── SlothletError static-hint path (line 62) ─────────────────────────────────

describe("SlothletError — static HINT_<CODE> lookup via slothlet config validation (line 62)", () => {
it("slothlet with null dir throws INVALID_CONFIG_DIR_MISSING and the error carries a hint (line 62)", async () => {
// Config validation checks dir before loading; null triggers INVALID_CONFIG_DIR_MISSING
// with { validationError: true }.  SlothletError constructor retrieves
// HINT_INVALID_CONFIG_DIR_MISSING from i18n → real string → line 62 fires:
//   translatedHint = staticHint
const err = await slothlet({ dir: null }).catch((e) => e);
expect(err).toBeInstanceOf(Error);
expect(err.code).toBe("INVALID_CONFIG_DIR_MISSING");
expect(err.hint).toBeDefined();
expect(typeof err.hint).toBe("string");
expect(err.hint.length).toBeGreaterThan(0);
});

it("the hint is a real translation, not a fallback 'Error:...' string (line 62)", async () => {
const err = await slothlet({ dir: null }).catch((e) => e);
expect(err.hint).not.toMatch(/^Error:/);
});

it("slothlet with empty-string dir also throws INVALID_CONFIG_DIR_MISSING with a hint (line 62)", async () => {
const err = await slothlet({ dir: "" }).catch((e) => e);
expect(err.code).toBe("INVALID_CONFIG_DIR_MISSING");
expect(err.hint).toBeDefined();
expect(err.hint).not.toMatch(/^Error:/);
});
});

// ─── SlothletWarning captured branch (line 184) ───────────────────────────────

describe("SlothletWarning — captured.push via deprecated-config warning through slothlet (line 184)", () => {
let api;

afterEach(async () => {
if (api && typeof api.shutdown === "function") {
await api.shutdown().catch(() => {});
}
api = null;
// Drain any warnings captured by this describe block so they don't bleed into other tests
SlothletWarning.captured.splice(0);
});

it("slothlet with allowMutation:false creates a V2_CONFIG_UNSUPPORTED warning captured in captured[] (line 184)", async () => {
// allowMutation is a v2 deprecated key → transformConfig calls new SlothletWarning(...).
// suppressConsole is true (set globally in vitest.setup.mjs).
// The warning constructor takes the else branch → line 184: captured.push(this).
// IMPORTANT: do NOT pass silent:true here — it gates the warning creation entirely.
const priorLength = SlothletWarning.captured.length;
api = await slothlet({ dir: TEST_DIRS.API_TEST, allowMutation: false });
expect(SlothletWarning.captured.length).toBeGreaterThan(priorLength);
});

it("the captured warning has code V2_CONFIG_UNSUPPORTED (line 184)", async () => {
api = await slothlet({ dir: TEST_DIRS.API_TEST, allowMutation: false });
const codes = SlothletWarning.captured.map((w) => w.code);
expect(codes).toContain("V2_CONFIG_UNSUPPORTED");
});
});
