/**
 * Function module for testing slothlet loader (exports a single function).
 * @param {string} name
 * @returns {string}
 * @example
 * import api from './api_test';
 * api.funcmod('slothlet'); // 'Hello, slothlet!'
 */
export default function(name) {
  return `Hello, ${name}!`;
}
