/**
 * @fileoverview Base class for Slothlet component classes providing common Slothlet access.
 * @module @cldmv/slothlet/factories/component-base
 * @package
 *
 * @description
 * Provides common getters for all Slothlet component classes (handlers, builders, processors).
 * All components extend this class to access the Slothlet instance's configuration and API
 * references without passing them through function parameters. Components become modular
 * extensions of the Slothlet class itself.
 *
 * @example
 * // ESM
 * import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
 * class MyHandler extends ComponentBase {
 *   doSomething() {
 *     if (this.debug?.api) {
 *       console.log("Debug mode enabled");
 *     }
 *     throw new this.SlothletError("ERROR_CODE", { details: "info" });
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
 * Provides common Slothlet property access for handlers, builders, and processors.
 * All component classes should extend this to gain consistent access to the Slothlet
 * instance's configuration, API references, and error classes. Components are instantiated
 * with a reference to the Slothlet class itself, making them modular extensions.
 *
 * @example
 * class ApiManager extends ComponentBase {
 *   constructor(slothlet) {
 *     super(slothlet);
 *     this.state = { addHistory: [] };
 *   }
 *
 *   someMethod() {
 *     if (this.debug?.api) {
 *       console.log(`Slothlet: ${this.instanceID}`);
 *     }
 *     throw new this.SlothletError("INVALID_CONFIG", { reason: "bad input" });
 *   }
 * }
 */
export class ComponentBase {
	/**
	 * Create a component base instance.
	 * @param {object} slothlet - Slothlet class instance.
	 * @package
	 *
	 * @description
	 * Stores the Slothlet reference for access via getters. The Slothlet class itself
	 * is passed (not a separate "instance" object), making components modular extensions
	 * of Slothlet.
	 *
	 * @example
	 * super(slothlet);
	 */
	constructor(slothlet) {
		this.slothlet = slothlet;
	}

	/**
	 * Get Slothlet configuration.
	 * @returns {object} Slothlet configuration object.
	 * @package
	 *
	 * @description
	 * Provides access to the Slothlet config for collision modes, debug settings, etc.
	 *
	 * @example
	 * const collisionMode = this.config.collision.api;
	 */
	get config() {
		return this.slothlet.config;
	}

	/**
	 * Get debug configuration.
	 * @returns {object|undefined} Debug configuration or undefined.
	 * @package
	 *
	 * @description
	 * Shorthand for accessing debug settings from the Slothlet configuration.
	 *
	 * @example
	 * if (this.debug?.api) { console.log("API debug enabled"); }
	 */
	get debug() {
		return this.slothlet.config?.debug;
	}

	/**
	 * Get Slothlet instance ID.
	 * @returns {string} Slothlet instance identifier.
	 * @package
	 *
	 * @description
	 * Returns the unique Slothlet instance ID for debugging and tracking.
	 *
	 * @example
	 * console.log(`Component for Slothlet: ${this.instanceID}`);
	 */
	get instanceID() {
		return this.slothlet.instanceID;
	}

	/**
	 * Get Slothlet API object.
	 * @returns {function|object} Slothlet API root.
	 * @package
	 *
	 * @description
	 * Provides direct access to the Slothlet's raw API object.
	 *
	 * @example
	 * const currentValue = this.api.plugins;
	 */
	get api() {
		return this.slothlet.api;
	}

	/**
	 * Get Slothlet bound API object.
	 * @returns {function|object} Slothlet bound API root.
	 * @package
	 *
	 * @description
	 * Provides direct access to the Slothlet's context-bound API object.
	 *
	 * @example
	 * const boundValue = this.boundApi.plugins;
	 */
	get boundApi() {
		return this.slothlet.boundApi;
	}

	/**
	 * Get SlothletError class.
	 * @returns {class} SlothletError constructor.
	 * @package
	 *
	 * @description
	 * Provides access to SlothletError without importing in every file.
	 * Components can throw errors via `new this.SlothletError(...)`.
	 *
	 * @example
	 * throw new this.SlothletError("INVALID_CONFIG", { reason: "missing dir" });
	 */
	get SlothletError() {
		return this.slothlet.SlothletError;
	}

	/**
	 * Get SlothletWarning class.
	 * @returns {class} SlothletWarning constructor.
	 * @package
	 *
	 * @description
	 * Provides access to SlothletWarning without importing in every file.
	 * Components can issue warnings via `new this.SlothletWarning(...)`.
	 *
	 * @example
	 * new this.SlothletWarning("WARNING_DEPRECATED", { feature: "oldApi" });
	 */
	get SlothletWarning() {
		return this.slothlet.SlothletWarning;
	}
}
