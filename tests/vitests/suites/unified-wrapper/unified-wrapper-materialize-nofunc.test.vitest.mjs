/**
 * @fileoverview Coverage for _materialize's no-materializeFunc path (unified-wrapper.mjs:1385
 * else). materializeFunc defaults to null, so a lazy wrapper constructed without one exercises the
 * branch where the materialize block is skipped entirely.
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-materialize-nofunc
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper, UnifiedWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/** @type {any} */
let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
});

describe("UnifiedWrapper._materialize no-func coverage", () => {
	it("_materialize on a lazy wrapper with no materializeFunc skips the materialize block (unified-wrapper.mjs:1385 else)", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = resolveWrapper(api.math).slothlet;
		// materializeFunc defaults to null; a lazy, not-yet-materialized wrapper reaches _materialize's
		// promise body and takes the `if (materializeFunc)` FALSE path (the block is skipped).
		const wrapper = new UnifiedWrapper(sl, { mode: "lazy", apiPath: "coverage.nofunc" });
		expect(wrapper.____slothletInternal.materializeFunc).toBe(null);
		await expect(wrapper._materialize()).resolves.toBeUndefined();
	});
});
