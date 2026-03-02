/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/modes-utils.mjs
 *	@Date: 2026-01-24 09:01:33 -08:00 (1737733293)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:38 -08:00 (1772425298)
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
