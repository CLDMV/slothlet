/**
 * @fileoverview Configuration normalization utilities
 * @module @cldmv/slothlet/helpers/config
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Configuration normalization utilities
 * @class Config
 * @extends ComponentBase
 * @public
 */
export class Config extends ComponentBase {
	static slothletProperty = "config";

	/**
	 * Normalize collision configuration for handling property collisions
	 * @param {string|Object} collision - Collision mode or object with per-context modes
	 * @returns {Object} Normalized collision configuration with initial and addApi modes
	 * @public
	 *
	 * @description
	 * Normalizes collision handling configuration for both initial load (buildAPI)
	 * and hot reload (api.add) contexts. Supports five collision modes:
	 * - "skip": Silently ignore collision, keep existing value
	 * - "warn": Warn about collision, keep existing value
	 * - "replace": Replace existing value completely
	 * - "merge": Merge properties (preserve original + add new)
	 * - "error": Throw error on collision
	 *
	 * @example
	 * // String shorthand applies to both contexts
	 * normalizeCollision("merge")
	 * // => { initial: "merge", addApi: "merge" }
	 *
	 * @example
	 * // Object allows per-context control
	 * normalizeCollision({ initial: "warn", addApi: "error" })
	 * // => { initial: "warn", addApi: "error" }
	 */
	normalizeCollision(collision) {
		const validModes = ["skip", "warn", "replace", "merge", "error"];
		const defaultMode = "merge";

		// String shorthand applies to both contexts
		if (typeof collision === "string") {
			const normalized = collision.toLowerCase();
			const mode = validModes.includes(normalized) ? normalized : defaultMode;
			return { initial: mode, addApi: mode };
		}

		// Object allows per-context control
		if (collision && typeof collision === "object") {
			const validateMode = (m) => {
				if (!m) return defaultMode;
				const normalized = String(m).toLowerCase();
				return validModes.includes(normalized) ? normalized : defaultMode;
			};
			return {
				initial: validateMode(collision.initial),
				addApi: validateMode(collision.addApi)
			};
		}

		// Default: merge for both contexts
		return { initial: defaultMode, addApi: defaultMode };
	}

	/**
	 * Normalize runtime input to internal standard format
	 * @param {string} runtime - Input runtime type (various formats accepted)
	 * @returns {string} Normalized runtime type ("async" or "live")
	 * @public
	 */
	normalizeRuntime(runtime) {
		if (!runtime || typeof runtime !== "string") {
			return "async"; // Default to AsyncLocalStorage
		}

		const normalized = runtime.toLowerCase().trim();

		// AsyncLocalStorage runtime variants
		if (normalized === "async" || normalized === "asynclocal" || normalized === "asynclocalstorage") {
			return "async";
		}

		// Live bindings runtime variants
		if (normalized === "live" || normalized === "livebindings" || normalized === "experimental") {
			return "live";
		}

		// Default to async for unknown values
		return "async";
	}

	/**
	 * Normalize mode input to internal standard format
	 * @param {string} mode - Input mode type (various formats accepted)
	 * @returns {string} Normalized mode type ("eager" or "lazy")
	 * @public
	 */
	normalizeMode(mode) {
		if (!mode || typeof mode !== "string") {
			return "eager"; // Default to eager
		}

		const normalized = mode.toLowerCase().trim();

		// Lazy mode variants
		if (normalized === "lazy" || normalized === "deferred" || normalized === "proxy") {
			return "lazy";
		}

		// Eager mode variants
		if (normalized === "eager" || normalized === "immediate" || normalized === "preload") {
			return "eager";
		}

		// Default to eager for unknown values
		return "eager";
	}

	/**
	 * Normalize debug configuration
	 * @param {boolean|Object} debug - Debug flag or object with targeted flags
	 * @returns {Object} Normalized debug object with all flags
	 * @public
	 */
	normalizeDebug(debug) {
		if (!debug) {
			return {
				builder: false,
				api: false,
				index: false,
				modes: false,
				wrapper: false,
				ownership: false,
				context: false
			};
		}

		// If debug is a boolean true, enable all debug flags
		if (debug === true) {
			return {
				builder: true,
				api: true,
				index: true,
				modes: true,
				wrapper: true,
				ownership: true,
				context: true
			};
		}

		// If debug is an object, merge with defaults
		if (typeof debug === "object") {
			return {
				builder: debug.builder || false,
				api: debug.api || false,
				index: debug.index || false,
				modes: debug.modes || false,
				wrapper: debug.wrapper || false,
				ownership: debug.ownership || false,
				context: debug.context || false
			};
		}

		// Unknown type, default to all false
		return {
			builder: false,
			api: false,
			index: false,
			modes: false,
			wrapper: false,
			ownership: false,
			context: false
		};
	}

	/**
	 * Transform and validate configuration
	 * @param {Object} config - Raw configuration options
	 * @returns {Object} Normalized configuration
	 * @throws {SlothletError} If configuration is invalid
	 * @public
	 */
	transformConfig(config = {}) {
		// Validate required fields
		if (!config.dir) {
			throw new this.SlothletError("INVALID_CONFIG_DIR_MISSING", {}, null, { validationError: true });
		}

		// Resolve relative paths from caller's context
		const resolvedDir = this.slothlet.helpers.resolver.resolvePathFromCaller(config.dir);

		// Build normalized config
		return {
			...config,
			dir: resolvedDir,
			mode: this.normalizeMode(config.mode),
			runtime: this.normalizeRuntime(config.runtime),
			reference: config.reference || null,
			context: config.context || null,
			debug: this.normalizeDebug(config.debug),
			diagnostics: config.diagnostics === true,
			hooks: config.hooks === true,
			collision: this.normalizeCollision(config.collision),
			backgroundMaterialize: config.backgroundMaterialize === true,
			silent: config.silent === true
		};
	}
}

// ============================================================================
// Backwards-compatible standalone exports
// ============================================================================

const configInstance = new Config();

export const normalizeCollision = configInstance.normalizeCollision.bind(configInstance);
export const normalizeRuntime = configInstance.normalizeRuntime.bind(configInstance);
export const normalizeMode = configInstance.normalizeMode.bind(configInstance);
export const normalizeDebug = configInstance.normalizeDebug.bind(configInstance);
export const transformConfig = configInstance.transformConfig.bind(configInstance);
