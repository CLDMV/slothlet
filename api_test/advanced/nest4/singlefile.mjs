/**
 * Function module for testing slothlet loader (exports a single function).
 * @param {string} name
 * @returns {string}
 * @example Function usage with slothlet loader
 * ```javascript
 * api.funcmod('slothlet'); // 'Hello, slothlet!'
 * ```
 */
export function beta(name) {
	return `Hello, ${name}!`;
}
