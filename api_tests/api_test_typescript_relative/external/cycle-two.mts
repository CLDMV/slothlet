import { cycleOneValue } from "./cycle-one.mts";

/** Half of a circular `.mts` ⇄ `.mts` relative-import pair. */
export const cycleTwoValue = "two";

/**
 * Combines both halves of the import cycle from the other direction.
 * @returns {string} `cycleTwoValue:cycleOneValue`.
 */
export function cycleTwo(): string {
	return `${cycleTwoValue}:${cycleOneValue}`;
}
