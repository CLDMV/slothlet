/**
 * Object with a callable default method for API loader testing.
 * @property {function} default - Default method for api.objectDefaultMethod()
 * @property {function} info - Named method for api.objectDefaultMethod.info()
 * @property {function} warn - Named method for api.objectDefaultMethod.warn()
 * @property {function} error - Named method for api.objectDefaultMethod.error()
 * @example Default and named method usage
 * ```javascript
 * api.objectDefaultMethod('Hello'); // calls default
 * api.objectDefaultMethod.info('Hello'); // calls info
 * api.objectDefaultMethod.warn('Hello'); // calls warn
 * api.objectDefaultMethod.error('Hello'); // calls error
 * ```
 */
export const objectDefaultMethod = {
	/**
	 * Default method for objectDefaultMethod. Calls the named method based on level.
	 * @param {string} message - Message to log.
	 * @param {string} [level="info"] - Level to use ('info', 'warn', 'error').
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.objectDefaultMethod('Hello'); // INFO: Hello
	 * api.objectDefaultMethod('Hello', 'warn'); // WARN: Hello
	 * ```
	 */
	default(message, level = "info") {
		if (typeof this[level] === "function") {
			return this[level](message);
		} else {
			return this.info(message);
		}
	},
	/**
	 * Info method for objectDefaultMethod.
	 * @param {string} message - Message to log.
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.objectDefaultMethod.info('Hello'); // INFO: Hello
	 * ```
	 */
	info(message) {
		return `INFO: ${message}`;
	},
	/**
	 * Warn method for objectDefaultMethod.
	 * @param {string} message - Message to log.
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.objectDefaultMethod.warn('Hello'); // WARN: Hello
	 * ```
	 */
	warn(message) {
		return `WARN: ${message}`;
	},
	/**
	 * Error method for objectDefaultMethod.
	 * @param {string} message - Message to log.
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.objectDefaultMethod.error('Hello'); // ERROR: Hello
	 * ```
	 */
	error(message) {
		return `ERROR: ${message}`;
	}
};
