import { pingCjs } from "../../external/helper-cjs.cjs";
import { pingMjs } from "../../external/helper-mjs.mjs";

/**
 * Same idea from a `.ts` source, exercising a `.cjs` (CommonJS) relative-import
 * target alongside a `.mjs` one — relative resolution must be module-system
 * agnostic.
 * @returns {string} The CJS and MJS helper markers joined with a colon.
 */
export function betaCombined(): string {
	return `${pingCjs()}:${pingMjs()}`;
}
