/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/utils/lifecycle.mjs
 *	@Date: 2025-10-30 09:25:21 -07:00 (1761841521)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-30 10:17:26 -07:00 (1761844646)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Module lifecycle utility functions.
 * @module @cldmv/node-android-tv-remote/utils/lifecycle
 * @public
 *
 * @description
 * Provides utilities for managing module initialization, monitoring, and shutdown
 * across the entire API surface. This centralizes the logic for discovering and
 * calling lifecycle methods on all modules.
 */
/**
 * Calls a lifecycle method on all modules that have it.
 * @param {string} methodName - Name of the lifecycle method to call
 * @param {Array} [args=[]] - Arguments to pass to the lifecycle method
 * @param {Object} [options={}] - Options for the lifecycle call
 * @param {string[]} [options.exclude=[]] - Module names to exclude from lifecycle calls
 * @param {boolean} [options.parallel=true] - Whether to call methods in parallel or series
 * @param {boolean} [options.continueOnError=true] - Whether to continue if a module fails
 * @param {string} [options.reason="lifecycle"] - Reason for the lifecycle call
 * @returns {Promise<Object>} Results object with success/failure counts and details
 *
 * @description
 * Scans the API surface for modules that implement the specified lifecycle method
 * and calls them with consistent error handling and logging.
 *
 * @example
 * // Initialize all modules
 * await self.utils.lifecycle.callAll('initialize');
 *
 * // Start monitoring on all modules
 * await self.utils.lifecycle.callAll('startMonitoring', [{ initialized: true }]);
 *
 * // Shutdown excluding connection module
 * await self.utils.lifecycle.callAll('shutdown', [], { exclude: ['connection'] });
 */
export function callAll(methodName: string, _?: any[]): Promise<any>;
/**
 * Gets a list of modules that implement a specific lifecycle method.
 * @param {string} methodName - Name of the method to check for
 * @param {string[]} [exclude=[]] - Module names to exclude from scan
 * @returns {string[]} Array of module names that implement the method
 *
 * @description
 * Utility function to discover which modules implement a specific lifecycle method
 * without actually calling them.
 *
 * @example
 * const initModules = self.utils.lifecycle.getModules('initialize');
 * console.log('Modules with initialize:', initModules);
 */
export function getModules(methodName: string, _?: any[]): string[];
/**
 * Common lifecycle method names used across modules.
 * @type {Object}
 * @readonly
 */
export const methods: any;
declare const _default: {};
export default _default;
//# sourceMappingURL=lifecycle.d.mts.map