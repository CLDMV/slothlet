/**
 * A `.mts` TypeScript helper outside the slothlet API directory, reached only
 * through relative `.mts` → `.mts` and `.ts` → `.mts` imports.
 * @returns {string} A fixed marker string.
 */
export function sharedTag(): string {
	return "shared-mts";
}
