/**
 * @fileoverview White-box coverage for two ApiManager guards: invalidateSpeculativeWrappers skipping
 * a reserved meta key, and mutateApiValue's identity (existing === next) early return.
 * @module tests/vitests/suites/api-manager/api-manager-coverage
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/** @type {any} */
let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
});

describe("ApiManager guard coverage", () => {
	it("invalidateSpeculativeWrappers skips reserved meta keys during its walk (api-manager.mjs:1011)", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const apiManager = resolveWrapper(api.math).slothlet.handlers.apiManager;
		// The walk enumerates own keys and `continue`s on reserved meta keys (__metadata/__type/…).
		expect(() => apiManager.invalidateSpeculativeWrappers({ __metadata: { a: 1 }, __type: "x", real: () => {} })).not.toThrow();
	});

	it("mutateApiValue returns early when existing === next (api-manager.mjs:1061-1062)", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const apiManager = resolveWrapper(api.math).slothlet.handlers.apiManager;
		const same = { shared: true };
		// Same reference on both sides → the identity guard returns before any merge work.
		await expect(apiManager.mutateApiValue(same, same, { removeMissing: false }, {})).resolves.toBeUndefined();
	});
});
