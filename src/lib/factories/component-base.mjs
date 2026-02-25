/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/factories/component-base.mjs
 *	@Date: 2026-01-24 09:30:16 -08:00 (1737735016)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-05 15:45:51 -08:00 (1770335151)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
 *     return this.____config.mode;
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
	 * Private backing field for the Slothlet instance reference.
	 * Using a private field instead of a non-configurable own property ensures that the
	 * JS Proxy invariant ("a non-configurable own property's get-trap must return the actual
	 * value") never fires for ____slothlet, so the underscore-filter in UnifiedWrapper's
	 * getTrap can safely block it before it leaks the Slothlet instance to user-land.
	 * @type {object}
	 * @private
	 */
	#slothlet;

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
		this.#slothlet = slothlet;
	}

	/**
	 * Get Slothlet instance via the canonical internal accessor name.
	 * @returns {object} Slothlet instance.
	 * @package
	 *
	 * @description
	 * Prototype getter — NOT an own property — so the JS Proxy invariant for
	 * non-configurable own properties never applies. UnifiedWrapper's getTrap blocks
	 * this name via the underscore-filter before it can reach the getter.
	 *
	 * @example
	 * const s = this.____slothlet;
	 */
	get ____slothlet() {
		return this.#slothlet;
	}

	/**
	 * Get Slothlet instance (internal access).
	 * @returns {object} Slothlet instance.
	 * @package
	 *
	 * @description
	 * Provides direct access to the Slothlet instance for legacy code compatibility.
	 * Prefer using specific getters (config, helpers, handlers) when possible.
	 *
	 * @example
	 * this.slothlet.debug("api", { action: "assigned" });
	 */
	get slothlet() {
		return this.#slothlet;
	}

	/**
	 * Get Slothlet configuration.
	 * @returns {object} Slothlet configuration object.
	 * @package
	 *
	 * @description
	 * Provides access to the Slothlet config for collision modes, debug settings, etc.
	 * Named with ____ prefix to avoid shadowing user API names like 'config'.
	 *
	 * @example
	 * const collisionMode = this.____config.collision.api;
	 */
	get ____config() {
		return this.____slothlet.config;
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
		return this.____slothlet.instanceID;
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
		return this.____slothlet.api;
	}

	/**
	 * Get Slothlet helpers object.
	 * @returns {object} Slothlet helpers.
	 * @package
	 *
	 * @description
	 * Provides access to internal helpers (resolver, sanitize, utilities, etc.).
	 *
	 * @example
	 * const path = this.helpers.resolver.resolvePathFromCaller('./config');
	 */
	get helpers() {
		return this.____slothlet.helpers;
	}

	/**
	 * Get Slothlet debug function.
	 * @returns {function} Slothlet debug function.
	 * @package
	 *
	 * @description
	 * Provides access to the debug logging function.
	 *
	 * @example
	 * this.debug("api", { action: "assigned", path: "math.add" });
	 */
	get debug() {
		return this.____slothlet.debug.bind(this.____slothlet);
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
		return this.____slothlet.SlothletError;
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
		return this.____slothlet.SlothletWarning;
	}
}
