/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/utilities.mjs
 *	@Date: 2025-12-30 19:29:09 -08:00 (1735612149)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:38 -08:00 (1772425298)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview General utility functions
 * @module @cldmv/slothlet/helpers/utilities
 * @internal
 * @package
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * General utility functions
 * @class Utilities
 * @extends ComponentBase
 * @package
 */
export class Utilities extends ComponentBase {
	static slothletProperty = "utilities";

	/**
	 * Check if value is a plain object
	 * @param {*} obj - Value to check
	 * @returns {boolean} True if plain object
	 * @public
	 */
	isPlainObject(obj) {
		if (typeof obj !== "object" || obj === null) return false;
		const proto = Object.getPrototypeOf(obj);
		return proto === null || proto === Object.prototype;
	}

	/**
	 * Deep merge two plain objects recursively.
	 *
	 * Differences from a simple spread:
	 * - Recursively merges nested plain objects rather than replacing them.
	 * - Uses `hasOwnProperty` to skip prototype-chain keys (no prototype pollution).
	 * - Non-plain values (arrays, class instances, primitives) are always copied by
	 *   value from `source`, never merged.
	 * - When `source[key]` is a plain object but `target[key]` is not (or absent),
	 *   the merge starts from `{}` so the returned sub-tree is always a fresh copy.
	 * - If either top-level argument is not a plain object, returns `source` as-is.
	 *
	 * @param {Object} target - Base object (not mutated).
	 * @param {Object} source - Source object whose keys are merged in.
	 * @returns {Object} New merged object.
	 * @public
	 */
	deepMerge(target, source) {
		if (!this.isPlainObject(target) || !this.isPlainObject(source)) {
			return source;
		}

		const result = { ...target };

		for (const key in source) {
			if (Object.prototype.hasOwnProperty.call(source, key)) {
				if (this.isPlainObject(source[key])) {
					// Recurse: start from target[key] if it's a plain object, otherwise {}
					// so new nested keys in source always produce a fresh copy.
					result[key] = this.deepMerge(this.isPlainObject(target[key]) ? target[key] : {}, source[key]);
				} else {
					result[key] = source[key];
				}
			}
		}

		return result;
	}

	/**
	 * Deep clone a value, handling Proxy objects and functions that `structuredClone`
	 * cannot serialise.
	 *
	 * Strategy:
	 * 1. Try `structuredClone` — fast and spec-correct for plain data.
	 * 2. Fall back to a manual recursive copy for Proxies, callables, and other
	 *    non-serialisable objects; errors on individual property clones are swallowed
	 *    and the original reference is retained for that key.
	 *
	 * @param {unknown} obj - Value to clone.
	 * @returns {unknown} Deep clone of `obj`.
	 * @public
	 */
	deepClone(obj) {
		try {
			return structuredClone(obj);
		} catch {
			// Fallback for Proxy / function / symbol values that structuredClone rejects.
			// Use .__type for Slothlet-wrapped objects, otherwise fall back to typeof.
			const objType = obj?.__type || typeof obj;
			if (obj === null || (objType !== "object" && objType !== "function")) return obj;
			if (obj instanceof Date) return new Date(obj.getTime());
			if (Array.isArray(obj)) return obj.map((item) => this.deepClone(item));
			// For callable Proxies and plain objects: clone all enumerable keys.
			const cloned = {};
			for (const key in obj) {
				try {
					cloned[key] = this.deepClone(obj[key]);
				} catch {
					// Keep original reference if an individual property can't be cloned.
					cloned[key] = obj[key];
				}
			}
			return cloned;
		}
	}

	/**
	 * Generate unique ID
	 * @returns {string} Unique identifier
	 * @public
	 */
	generateId() {
		return `slothlet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}
