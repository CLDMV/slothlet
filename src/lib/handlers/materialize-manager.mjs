/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/materialize-manager.mjs
 *	@Date: 2026-02-13T22:54:12-08:00 (1771052052)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:37 -08:00 (1772425297)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Materialization tracking manager for lazy mode
 * @module @cldmv/slothlet/handlers/materialize-manager
 * @internal
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Manager for tracking lazy folder materialization state
 * @class MaterializeManager
 * @extends ComponentBase
 * @package
 *
 * @description
 * Provides access to lazy materialization state via `api.slothlet.materialize`.
 * Tracks count of unmaterialized lazy folders and provides boolean state, statistics,
 * and wait functionality for synchronization.
 *
 * @example
 * const api = await slothlet({ dir: "./api", mode: "lazy" });
 * 
 * // Check if fully materialized
 * if (api.slothlet.materialize.materialized) {
 *   console.log("All lazy folders loaded!");
 * }
 * 
 * // Get statistics
 * const stats = api.slothlet.materialize.get();
 * console.log(`${stats.percentage}% loaded (${stats.remaining}/${stats.total} remaining)`);
 * 
 * // Wait for full materialization
 * await api.slothlet.materialize.wait();
 */
export class MaterializeManager extends ComponentBase {
	static slothletProperty = "materialize";

	/**
	 * Create MaterializeManager instance
	 * @param {object} slothlet - Slothlet orchestrator instance
	 * @package
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Get materialization state as a boolean
	 * Returns true when all lazy wrappers have been materialized
	 * @returns {boolean} True if fully materialized, false if any lazy folders remain
	 * @public
	 *
	 * @example
	 * if (api.slothlet.materialize.materialized) {
	 *   console.log("API is fully loaded");
	 * }
	 */
	get materialized() {
		return this.slothlet._unmaterializedLazyCount === 0;
	}

	/**
	 * Get detailed materialization statistics
	 * @returns {Object} Statistics object with total, materialized, remaining, percentage
	 * @public
	 *
	 * @example
	 * const stats = api.slothlet.materialize.get();
	 * // { total: 5, materialized: 3, remaining: 2, percentage: 60 }
	 */
	get() {
		const total = this.slothlet._totalLazyCount;
		const remaining = this.slothlet._unmaterializedLazyCount;
		const materialized = total - remaining;
		const percentage = total > 0 ? Math.round((materialized / total) * 100) : 100;

		return {
			total,
			materialized,
			remaining,
			percentage
		};
	}

	/**
	 * Wait for full materialization (all lazy folders loaded)
	 * Returns immediately if already fully materialized
	 * @returns {Promise<void>} Resolves when all lazy wrappers have materialized
	 * @public
	 *
	 * @example
	 * // Wait for API to fully load
	 * await api.slothlet.materialize.wait();
	 * console.log("All modules loaded!");
	 * 
	 * @example
	 * // Wait with timeout
	 * const timeoutPromise = new Promise((_, reject) =>
	 *   setTimeout(() => reject(new Error("Timeout")), 5000)
	 * );
	 * await Promise.race([
	 *   api.slothlet.materialize.wait(),
	 *   timeoutPromise
	 * ]);
	 */
	async wait() {
		// If already materialized, return immediately
		if (this.slothlet._unmaterializedLazyCount === 0) {
			return;
		}

		// Create a promise that will resolve when materialization completes
		return new Promise((resolve) => {
			this.slothlet._materializationWaiters.push(resolve);
		});
	}
}
