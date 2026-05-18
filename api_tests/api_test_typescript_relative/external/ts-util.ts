import { sharedTag } from "./ts-shared.mts";

/**
 * A `.ts` TypeScript helper that itself relatively imports a `.mts` helper —
 * exercises a transitive `.ts` → `.mts` relative-import chain.
 * @returns {string} A marker string wrapping the transitively-imported value.
 */
export function utilTs(): string {
	return `util-ts(${sharedTag()})`;
}
