/**
 * @fileoverview TypeScript leaf importing a `.ts` helper and the SAME `.mjs` helper the ESM leaves
 * import — within one instance the `.mjs` helper must be one copy across formats (#518).
 * @module api_test_helper_imports.tsleaf
 */
import { tsBump } from "../../lib/ts-helper.ts";
import { bump } from "../../lib/state.mjs";

/**
 * Bump the `.ts` helper's counter.
 * @returns {number} The counter after incrementing.
 */
export function tsCount(): number {
	return tsBump();
}

/**
 * Bump the shared `lib/state.mjs` counter.
 * @returns {number} The counter after incrementing.
 */
export function count(): number {
	return bump();
}
