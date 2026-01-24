/**
 * @fileoverview Base class for Slothlet component classes providing common instance access.
 * @module @cldmv/slothlet/factories/component-base
 * @package
 *
 * @description
 * Provides common getters for all Slothlet component classes (handlers, builders, processors).
 * All components extend this class to access instance configuration and API references without
 * passing them through function parameters.
 *
 * @example
 * // ESM
 * import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
 * class MyHandler extends ComponentBase {
 *   doSomething() {
 *     if (this.debug?.api) {
 *       console.log("Debug mode enabled");
 *     }
 *   }
 * }
 *
 * @example
 * // CJS
 * const { ComponentBase } = require("@cldmv/slothlet/factories/component-base");
 * class MyHandler extends ComponentBase {
 *   doSomething() {
 *     return this.config.mode;
 *   }
 * }
 */

/**
 * Base class for Slothlet component classes.
 * @class ComponentBase
 * @package
 *
 * @description
 * Provides common instance property access for handlers, builders, and processors.
 * All component classes should extend this to gain consistent access to instance
 * configuration and API references.
 *
 * @example
 * class ApiManager extends ComponentBase {
 *   constructor(instance) {
 *     super(instance);
 *     this.state = { addHistory: [] };
 *   }
 *
 *   someMethod() {
 *     if (this.debug?.api) {
 *       console.log(`Instance: ${this.instanceID}`);
 *     }
 *   }
 * }
 */
export class ComponentBase {
	/**
	 * Create a component base instance.
	 * @param {object} instance - Slothlet instance.
	 * @package
	 *
	 * @description
	 * Stores the instance reference for access via getters.
	 *
	 * @example
	 * super(instance);
	 */
	constructor(instance) {
		this.instance = instance;
	}

	/**
	 * Get instance configuration.
	 * @returns {object} Instance configuration object.
	 * @package
	 *
	 * @description
	 * Provides access to the instance config for collision modes, debug settings, etc.
	 *
	 * @example
	 * const collisionMode = this.config.collision.addApi;
	 */
	get config() {
		return this.instance.config;
	}

	/**
	 * Get debug configuration.
	 * @returns {object|undefined} Debug configuration or undefined.
	 * @package
	 *
	 * @description
	 * Shorthand for accessing debug settings from the instance configuration.
	 *
	 * @example
	 * if (this.debug?.api) { console.log("API debug enabled"); }
	 */
	get debug() {
		return this.instance.config?.debug;
	}

	/**
	 * Get instance ID.
	 * @returns {string} Instance identifier.
	 * @package
	 *
	 * @description
	 * Returns the unique instance ID for debugging and tracking.
	 *
	 * @example
	 * console.log(`Component for instance: ${this.instanceID}`);
	 */
	get instanceID() {
		return this.instance.instanceID;
	}

	/**
	 * Get instance API object.
	 * @returns {function|object} Instance API root.
	 * @package
	 *
	 * @description
	 * Provides direct access to the instance's raw API object.
	 *
	 * @example
	 * const currentValue = this.api.plugins;
	 */
	get api() {
		return this.instance.api;
	}

	/**
	 * Get instance bound API object.
	 * @returns {function|object} Instance bound API root.
	 * @package
	 *
	 * @description
	 * Provides direct access to the instance's context-bound API object.
	 *
	 * @example
	 * const boundValue = this.boundApi.plugins;
	 */
	get boundApi() {
		return this.instance.boundApi;
	}
}
