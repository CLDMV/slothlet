/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/modes-utils.mjs
 *	@Date: 2026-01-24 09:01:33 -08:00 (1737733293)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 00:00:00 -08:00 (1770192000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
	 * @param {string} collisionContext - Either 'initial' or 'api'
	 * @returns {string} Collision mode from config
	 * @public
	 */
	getOwnershipCollisionMode(config, collisionContext = "initial") {
		return config.collision?.[collisionContext] || "merge";
	}
}
