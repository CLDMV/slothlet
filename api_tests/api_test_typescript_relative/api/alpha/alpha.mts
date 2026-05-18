import { pingMjs } from "../../external/helper-mjs.mjs";
import { nestedTag } from "../../external/nested/value.mjs";

/**
 * Combines two relatively-imported plain-ESM helpers that live OUTSIDE the
 * slothlet API directory. Proves a `.mts` module reaches `.mjs` files through
 * relative specifiers, including a deeper `../../…/nested/` path.
 * @returns {string} The two helper markers joined with a colon.
 */
export function combined(): string {
	return `${pingMjs()}:${nestedTag()}`;
}
