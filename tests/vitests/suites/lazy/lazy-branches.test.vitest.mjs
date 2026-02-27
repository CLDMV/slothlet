/**
 *@Project: @cldmv/slothlet
 *@Filename: /tests/vitests/suites/lazy/lazy-branches.test.vitest.mjs
 *@Date: 2026-02-27T00:00:00-08:00 (1772169600)
 *@Author: Nate Hyson <CLDMV>
 *@Email: <Shinrai@users.noreply.github.com>
 *-----
 *@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *@Last modified time: 2026-02-27 00:00:00 -08:00 (1772169600)
 *-----
 *@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Branch-coverage tests for LazyMode.createNamedMaterializeFunc (lazy.mjs lines 49–52)
 * exercised through the public slothlet API.
 *
 * @description
 * The ternary on lazy.mjs lines 49–52 has three branches:
 *
 *   1. `safePath && /^[A-Za-z_$]/.test(safePath[0])` → use safePath as-is.
 *      (the normal path — always exercised by the existing suite)
 *
 *   2. `safePath ? \`_${safePath}\`` → safePath is non-empty but starts with a digit.
 *      **← THIS BRANCH WAS UNCOVERED (lines 49–52 branch 2)**
 *
 *   3. `"api"` fallback — confirmed dead: `apiPath || "api"` guard always produces
 *      a non-empty string from sanitized property names.
 *
 * How branch 2 is triggered through slothlet:
 *   `api.slothlet.api.add("2root", dir)` — the first arg is the API mount path.
 *   api-manager normalises it to `normalizedPath = "2root"` (no sanitization on the path
 *   segment itself, only reserved-name checking).  It then passes this as `apiPathPrefix:"2root"`
 *   to buildAPI.  In lazy mode, processFiles sets:
 *     `apiPath = categoryName ? ... : apiPathPrefix ? "${apiPathPrefix}.${subDirName}" : subDirName`
 *   At root level `categoryName` is null, so `apiPath = "2root.interop"`.
 *   Inside createNamedMaterializeFunc:
 *     `safePath = "2root__interop"` (dot replaced)
 *     `/^[A-Za-z_$]/.test("2")` === false → branch 2 → `normalized = "_2root__interop"`.
 *
 * @module tests/vitests/suites/lazy/lazy-branches
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── branch 2: digit-prefixed apiPathPrefix via api.slothlet.api.add (lines 49-52) ──

describe("LazyMode.createNamedMaterializeFunc — _-prefixed normalised name via slothlet (lines 49-52)", () => {
let api;

afterEach(async () => {
if (api && typeof api.shutdown === "function") {
await api.shutdown().catch(() => {});
}
api = null;
});

it("api.slothlet.api.add with a digit-prefixed path triggers branch 2 without errors (line 50)", async () => {
// Create a lazy slothlet instance, then add TEST_DIRS.API_TEST_MIXED at path "2root".
// api_test_mixed has an interop/ subdirectory.
// api-manager passes apiPathPrefix="2root" → processFiles builds apiPath="2root.interop"
// createNamedMaterializeFunc("2root.interop",...) is called at build time.
// safePath="2root__interop"; /^[A-Za-z_$]/.test("2")===false → branch 2: normalized="_2root__interop"
api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
await expect(api.slothlet.api.add("2root", TEST_DIRS.API_TEST_MIXED)).resolves.toBeDefined();
});

it("the digit-prefixed namespace is accessible on the api object after the add call", async () => {
api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
await api.slothlet.api.add("2root", TEST_DIRS.API_TEST_MIXED);
// "2root" must be accessible via bracket notation (digit-start is valid JS property)
expect(api["2root"]).toBeDefined();
});

it("the digit-prefixed namespace contains the flat modules from the loaded directory", async () => {
api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
await api.slothlet.api.add("2root", TEST_DIRS.API_TEST_MIXED);
// api_test_mixed root has math-esm.mjs and math-cjs.cjs (sanitised to mathEsm / mathCjs)
// These are loaded as direct properties since they are files, not subdirectories.
expect(api["2root"].mathEsm ?? api["2root"].mathCjs).toBeDefined();
});

// ─── branch 1: normal letter-starting path (regression) ──────────────────

it("a letter-starting api.add path works correctly — branch 1 regression via slothlet", async () => {
api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
await expect(api.slothlet.api.add("tools", TEST_DIRS.API_TEST_MIXED)).resolves.toBeDefined();
expect(api.tools).toBeDefined();
});
});
