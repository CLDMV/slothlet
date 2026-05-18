import { pingMjs } from "../../external/helper-mjs.mjs";
import { nestedTag } from "../../external/nested/value.mjs";
import { sharedTag } from "../../external/ts-shared.mts";

/**
 * Combines plain-ESM helpers and a `.mts` TypeScript helper, all relatively
 * imported from outside the slothlet API directory. Proves a `.mts` module
 * can reach `.mjs` files and another `.mts` source through relative specifiers.
 * @returns {string} The three helper markers joined with colons.
 */
export function combined(): string {
	return `${pingMjs()}:${nestedTag()}:${sharedTag()}`;
}
