/**
 * @fileoverview Pure utility functions for mode processing
 * @module @cldmv/slothlet/helpers/modes-utils
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Mode processing utilities component class
 * @extends ComponentBase
 */
export class ModesUtils extends ComponentBase {
	static slothletProperty = "modesUtils";

	/**
	 * Build a safe function name for debug output from an API path or module name.
	 * @param {string} name - Name hint to sanitize.
	 * @param {string} fallback - Fallback name if the hint is unusable.
	 * @returns {string} Safe function name.
	 * @public
	 */
	getSafeFunctionName(name, fallback) {
		const safeBase = String(name || "").replace(/[^A-Za-z0-9_$]/g, "_");
		const normalized = safeBase && /^[A-Za-z_$]/.test(safeBase[0]) ? safeBase : safeBase ? `_${safeBase}` : "";
		return normalized || fallback;
	}

	/**
	 * Create a named wrapper for default export functions when they are anonymous.
	 * NOTE: This function is now a pass-through since UnifiedWrapper handles name/length/toString
	 * through its proxy get trap. Wrapping is no longer needed and causes toString mismatches.
	 * @param {Function} fn - Original function.
	 * @param {string} nameHint - Name to apply if fn is anonymous or named "default" (unused).
	 * @returns {Function} Original function unmodified.
	 * @public
	 */
	ensureNamedExportFunction(fn, nameHint) {
		// UnifiedWrapper now handles name, length, and toString through proxy get trap
		// No wrapping needed - return original function as-is
		return fn;
	}

	/**
	 * Create a named async materialization function for lazy subdirectories.
	 * @param {string} apiPath - API path to derive the function name from.
	 * @param {Function} handler - Async handler that performs materialization.
	 * @returns {Function} Named async materialization function.
	 * @public
	 */
	createNamedMaterializeFunc(apiPath, handler) {
		const safePath = String(apiPath || "api")
			.replace(/\./g, "__")
			.replace(/[^A-Za-z0-9_$]/g, "_");
		const normalized = safePath && /^[A-Za-z_$]/.test(safePath[0]) ? safePath : safePath ? `_${safePath}` : "api";
		const funcName = `${normalized}__lazy_materializeFunc`;
		return {
			[funcName]: async function (...args) {
				return handler(...args);
			}
		}[funcName];
	}

	/**
	 * Clone eager-mode module exports to avoid mutating import cache objects.
	 * @param {unknown} value - Value to clone for wrapping
	 * @param {string} mode - Current mode ("eager" or "lazy")
	 * @returns {unknown} Cloned value for eager mode, original otherwise
	 * @public
	 */
	cloneWrapperImpl(value, mode) {
		if (mode !== "eager") {
			return value;
		}
		if (!value || typeof value !== "object") {
			return value;
		}
		if (Array.isArray(value)) {
			return value.slice();
		}
		const descriptors = Object.getOwnPropertyDescriptors(value);
		return Object.create(Object.getPrototypeOf(value), descriptors);
	}

	/**
	 * Helper to determine collision mode for ownership conflicts
	 * @param {Object} config - Slothlet configuration
	 * @param {string} collisionContext - Either 'initial' or 'addApi'
	 * @returns {string} Collision mode from config
	 * @public
	 */
	getOwnershipCollisionMode(config, collisionContext = "initial") {
		return config.collision?.[collisionContext] || "merge";
	}
}

// Backwards-compatible standalone exports
const modesUtilsInstance = new ModesUtils();

export const getSafeFunctionName = modesUtilsInstance.getSafeFunctionName.bind(modesUtilsInstance);
export const ensureNamedExportFunction = modesUtilsInstance.ensureNamedExportFunction.bind(modesUtilsInstance);
export const createNamedMaterializeFunc = modesUtilsInstance.createNamedMaterializeFunc.bind(modesUtilsInstance);
export const cloneWrapperImpl = modesUtilsInstance.cloneWrapperImpl.bind(modesUtilsInstance);
export const getOwnershipCollisionMode = modesUtilsInstance.getOwnershipCollisionMode.bind(modesUtilsInstance);
