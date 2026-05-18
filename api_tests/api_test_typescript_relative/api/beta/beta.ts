import { pingCjs } from "../../external/helper-cjs.cjs";
import { utilTs } from "../../external/ts-util.ts";

/**
 * Combines a `.cjs` (CommonJS) helper with a `.ts` TypeScript helper that
 * itself relatively imports a `.mts` helper — exercises a `.ts` → `.ts` → `.mts`
 * relative-import chain from a `.ts` source.
 * @returns {string} The CJS and (transitive) TypeScript markers joined.
 */
export function betaCombined(): string {
	return `${pingCjs()}|${utilTs()}`;
}
