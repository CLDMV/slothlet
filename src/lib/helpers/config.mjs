/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/config.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 00:00:00 -08:00 (1770192000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
	 * @returns {Object} Normalized collision configuration with initial and api.slothlet.api.add modes
	 * @public
	 *
	 * @description
	 * Normalizes collision handling configuration for both initial load (buildAPI)
	 * and hot reload (api.add) contexts. Supports six collision modes:
	 * - "skip": Silently ignore collision, keep existing value
	 * - "warn": Warn about collision, keep existing value
	 * - "replace": Replace existing value completely
	 * - "merge": Merge properties (preserve original + add new)
	 * - "merge-replace": Merge properties (add new + overwrite existing with new values)
	 * - "error": Throw error on collision
	 *
	 * @example
	 * // String shorthand applies to both contexts
	 * normalizeCollision("merge")
	 * // => { initial: "merge", api: "merge" }
	 *
	 * @example
	 * // Object allows per-context control
	 * normalizeCollision({ initial: "warn", api: "error" })
	 * // => { initial: "warn", api: "error" }
	 */
	normalizeCollision(collision) {
		const validModes = ["skip", "warn", "replace", "merge", "merge-replace", "error"];
		const defaultMode = "merge";

		// String shorthand applies to both contexts
		if (typeof collision === "string") {
			const normalized = collision.toLowerCase();
			const mode = validModes.includes(normalized) ? normalized : defaultMode;
			return { initial: mode, api: mode };
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
				api: validateMode(collision.api)
			};
		}

		// Default: merge for both contexts
		return { initial: defaultMode, api: defaultMode };
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
	 * Normalize mutations configuration for API modification control
	 * @param {Object} mutations - Mutations config object with add/remove/reload properties
	 * @returns {Object} Normalized mutations configuration
	 * @public
	 *
	 * @description
	 * Normalizes mutation control configuration for API runtime modifications.
	 * Controls whether api.slothlet.api.add(), api.slothlet.api.remove(), and
	 * api.slothlet.reload() operations are allowed.
	 *
	 * @example
	 * // Allow all mutations (default)
	 * normalizeMutations({ add: true, remove: true, reload: true })
	 * // => { add: true, remove: true, reload: true }
	 *
	 * @example
	 * // Disable all mutations
	 * normalizeMutations({ add: false, remove: false, reload: false })
	 * // => { add: false, remove: false, reload: false }
	 */
	normalizeMutations(mutations) {
		const defaults = { add: true, remove: true, reload: true };

		// If mutations is not an object, use defaults
		if (!mutations || typeof mutations !== "object") {
			return defaults;
		}

		// Merge with defaults, ensuring boolean values
		return {
			add: mutations.add === false ? false : true,
			remove: mutations.remove === false ? false : true,
			reload: mutations.reload === false ? false : true
		};
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

		// ===== BACKWARD COMPATIBILITY =====
		// Handle deprecated allowMutation config (v2 compatibility)
		let mutations = null;
		if (config.allowMutation === false) {
			// Map allowMutation: false to all mutations disabled
			mutations = { add: false, remove: false, reload: false };
			if (!config.silent) {
				new this.SlothletWarning("V2_CONFIG_UNSUPPORTED", {
					option: "allowMutation",
					replacement: "api.mutations: { add: false, remove: false, reload: false }",
					hint: "The allowMutation config option was part of v2. Use api.mutations for granular control in v3."
				});
			}
		}

		// Handle root-level collision config (backward compatibility)
		// TODO: Remove before v3 release - this was a v3 development thing, not v2 backward compat
		let collision = null;
		if (config.collision && !config.api?.collision) {
			collision = this.normalizeCollision(config.collision);
			if (!config.silent) {
				new this.SlothletWarning("V2_CONFIG_UNSUPPORTED", {
					option: "collision",
					replacement: "api.collision",
					hint: "Root-level collision config was part of v2. Use api.collision in v3."
				});
			}
		}

		// Process api.* namespace (new v3 structure)
		const apiConfig = config.api || {};
		const finalCollision = apiConfig.collision ? this.normalizeCollision(apiConfig.collision) : collision || this.normalizeCollision(null);
		const finalMutations = apiConfig.mutations ? this.normalizeMutations(apiConfig.mutations) : mutations || this.normalizeMutations(null);

		// Validate scope.merge strategy if provided
		let scopeConfig = config.scope;
		if (scopeConfig && typeof scopeConfig === "object" && scopeConfig.merge) {
			const validMergeStrategies = ["shallow", "deep"];
			if (!validMergeStrategies.includes(scopeConfig.merge)) {
				throw new this.SlothletError(
					"INVALID_CONFIG",
					{
						option: "scope.merge",
						value: scopeConfig.merge,
						expected: validMergeStrategies.join(" or "),
						hint: `Invalid merge strategy: "${scopeConfig.merge}". Must be "shallow" or "deep".`,
						validationError: true
					},
					null,
					{ validationError: true }
				);
			}
		}

		// Parse hook configuration (V2-style support)
		let hookConfig = { enabled: false, pattern: "**", suppressErrors: false };
		if (config.hook === true || config.hook === false) {
			// Boolean: enabled/disabled with all patterns
			hookConfig.enabled = config.hook;
			hookConfig.pattern = config.hook ? "**" : null;
		} else if (typeof config.hook === "string") {
			// String: enabled with specific pattern
			hookConfig.enabled = true;
			hookConfig.pattern = config.hook;
		} else if (config.hook && typeof config.hook === "object") {
			// Object: { enabled, pattern, suppressErrors }
			hookConfig.enabled = config.hook.enabled !== false; // Default true if object provided
			hookConfig.pattern = config.hook.pattern || "**";
			hookConfig.suppressErrors = config.hook.suppressErrors || false;
		}

		// Parse tracking configuration
		let trackingConfig = { materialization: false };
		if (config.tracking === true || config.tracking === false) {
			// Boolean: enable/disable materialization tracking
			trackingConfig.materialization = config.tracking;
		} else if (config.tracking && typeof config.tracking === "object") {
			// Object: { materialization: boolean }
			trackingConfig.materialization = config.tracking.materialization === true;
		}

		// Build normalized config
		return {
			...config,
			dir: resolvedDir,
			mode: this.normalizeMode(config.mode),
			runtime: this.normalizeRuntime(config.runtime),
			apiDepth: config.apiDepth !== undefined ? config.apiDepth : Infinity,
			reference: config.reference || null,
			context: config.context || null,
			debug: this.normalizeDebug(config.debug),
			diagnostics: config.diagnostics === true,
			hook: hookConfig,
			collision: finalCollision,
			api: {
				collision: finalCollision,
				mutations: finalMutations
			},
			scope: scopeConfig,
			tracking: trackingConfig,
			backgroundMaterialize: config.backgroundMaterialize === true,
			silent: config.silent === true
		};
	}
}
