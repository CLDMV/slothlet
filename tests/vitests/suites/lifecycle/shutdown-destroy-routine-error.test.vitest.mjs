/**
 * @fileoverview Coverage for the routine-error capture/rethrow paths in `api.slothlet.shutdown()`
 * and `api.destroy()` (api_builder.mjs). A `mode: "shutdown"`/`"destroy"` routine can throw; those
 * entry points must capture it, still run internal teardown, then rethrow — driven here by making
 * the run*ModeRoutines call (and, for the both-throw case, the internal shutdown) throw.
 * @module tests/vitests/suites/lifecycle/shutdown-destroy-routine-error
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/** @type {any} */
let api;
afterEach(async () => {
	try {
		if (api?.slothlet && !api.slothlet.isDestroyed && typeof api.slothlet.shutdown === "function") await api.slothlet.shutdown();
	} catch {
		/* already torn down / deliberate throw */
	}
	api = null;
});

describe("shutdown/destroy routine-error capture (api_builder)", () => {
	it("api.slothlet.shutdown() rethrows a throwing shutdown-mode routine after teardown (2350, 2353)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, silent: true });
		const rm = resolveWrapper(api.ping).slothlet.handlers.routineManager;
		const boom = new Error("shutdown routine boom");
		rm.runShutdownModeRoutines = async () => {
			throw boom;
		};
		await expect(api.slothlet.shutdown()).rejects.toBe(boom);
	});

	it("api.destroy() rethrows a throwing destroy-mode routine after teardown (3599)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, silent: true });
		const rm = resolveWrapper(api.ping).slothlet.handlers.routineManager;
		const boom = new Error("destroy routine boom");
		rm.runDestroyModeRoutines = async () => {
			throw boom;
		};
		await expect(api.destroy()).rejects.toBe(boom);
	});

	it("api.destroy() keeps the destroy-routine error when the internal shutdown also throws (3620 false branch)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, silent: true });
		const rm = resolveWrapper(api.ping).slothlet.handlers.routineManager;
		const destroyBoom = new Error("destroy routine boom");
		// destroy-mode routine throws → routineError is set BEFORE the internal shutdown runs.
		rm.runDestroyModeRoutines = async () => {
			throw destroyBoom;
		};
		// The internal api.shutdown() then also throws (its own shutdown-routine cascade throws), so
		// destroy's shutdown try/catch reaches `if (!routineError)` — which must NOT overwrite the
		// already-captured destroy error (3620's false branch), so destroyBoom is what surfaces.
		rm.runShutdownModeRoutines = async () => {
			throw new Error("shutdown also boom");
		};
		await expect(api.destroy()).rejects.toBe(destroyBoom);
	});
});
