/**
 * Greets a name (default export).
 * @param {string} name - Name to greet.
 * @returns {string} Greeting message.
 * @example Default function usage
 * ```javascript
 * api.rootFunction('World'); // 'Hello, World!'
 * ```
 */
export default function greet(name) {
	return `Hello, ${name}!`;
}

/**
 * Shouts a greeting.
 * @param {string} name
 * @returns {string}
 * @example
 * ```javascript
 * api.rootFunctionShout('World'); // 'HELLO, WORLD!'
 * ```
 */
export function rootFunctionShout(name) {
	return `HELLO, ${name.toUpperCase()}!`;
}

/**
 * Whispers a greeting.
 * @param {string} name
 * @returns {string}
 * @example
 * ```javascript
 * api.rootFunctionWhisper('World'); // 'hello, world.'
 * ```
 */
export function rootFunctionWhisper(name) {
	return `hello, ${name.toLowerCase()}.`;
}
