/**
 * Alpha module for multi-file API loader test (exports a function).
 * @param {string} name
 * @returns {string}
 * @example
 * import api from './api_test';
 * api.multi_func.alpha('alpha'); // 'alpha: alpha'
 */
export default function (name) {
	return `alpha: ${name}`;
}
