/**
 * Alpha module for multi-file API loader test (exports a function).
 * @param {string} name
 * @returns {string}
 * @example Alpha function usage
 * ```javascript
 * api.multi_func.alpha('alpha'); // 'alpha: alpha'
 * ```
 */
export function alpha(name) {
	return `alpha: ${name}`;
}
