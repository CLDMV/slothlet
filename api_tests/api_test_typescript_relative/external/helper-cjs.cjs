/**
 * CommonJS (`.cjs`) module imported with a relative specifier from a
 * TypeScript API module — relative imports must resolve `.cjs` too, not just
 * `.mjs`.
 * @returns {string} A fixed marker string.
 */
function pingCjs() {
	return "cjs-pong";
}

module.exports = { pingCjs };
