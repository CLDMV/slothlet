import { cycleOne } from "../../external/cycle-one.mts";

/**
 * Reaches into a circular `.mts` ⇄ `.mts` relative-import pair — exercises
 * cycle handling in the recursive transpile/cache step.
 * @returns {string} The combined value from both halves of the cycle.
 */
export function gammaCheck(): string {
	return cycleOne();
}
