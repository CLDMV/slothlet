import { cycleTwoValue } from "./cycle-two.mts";

/** Half of a circular `.mts` ⇄ `.mts` relative-import pair. */
export const cycleOneValue = "one";

/**
 * Combines both halves of the import cycle.
 * @returns {string} `cycleOneValue:cycleTwoValue`.
 */
export function cycleOne(): string {
	return `${cycleOneValue}:${cycleTwoValue}`;
}
