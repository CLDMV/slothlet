/**
 * Plain ESM (`.mjs`) module living OUTSIDE the slothlet API directory, imported
 * with a relative specifier from a TypeScript API module.
 * @returns {string} A fixed marker string.
 */
export function pingMjs() {
	return "mjs-pong";
}
