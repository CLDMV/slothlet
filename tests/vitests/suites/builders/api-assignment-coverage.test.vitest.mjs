/**
 * @fileoverview Coverage for ApiAssignment.assignToApiPath's collision-mode resolution middle arm
 * (api-assignment.mjs:253): `collisionModeOverride || config.collision?.[collisionContext] || "merge"`
 * taking the config.collision value when no per-call override is supplied.
 * @module tests/vitests/suites/builders/api-assignment-coverage
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

describe("ApiAssignment collision-mode arm coverage", () => {
	it("uses config.collision[collisionContext] when no collisionModeOverride is given (api-assignment.mjs:253 arm 2)", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const assignment = resolveWrapper(api.math).slothlet.builders.apiAssignment;
		// Case 2 (collision detection): existing !== undefined, no collisionModeOverride, so the
		// resolved mode comes from config.collision[collisionContext] ("skip") — the middle arm.
		const target = { foo: "old" };
		const result = await assignment.assignToApiPath(target, "foo", "new", {
			useCollisionDetection: true,
			config: { collision: { initial: "skip" } },
			collisionContext: "initial"
		});
		// "skip" keeps the existing value and reports false.
		expect(result).toBe(false);
		expect(target.foo).toBe("old");
	});
});
