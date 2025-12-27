export = slothlet;
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /index.cjs
 *	@Date: 2025-11-09 11:15:17 -08:00 (1762715717)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-11-09 14:43:17 -08:00 (1762728197)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview CommonJS entry point for @cldmv/slothlet - imports ESM implementation for single source of truth.
 * @module @cldmv/slothlet
 */
/**
 * CommonJS entry that dynamically imports the ESM implementation.
 * This ensures single source of truth in index.mjs while maintaining CJS compatibility.
 * Eliminates code duplication between entry points and ensures consistent behavior.
 * @public
 * @async
 * @param {object} [options={}] - Configuration options for the slothlet instance
 * @param {string} [options.dir="api"] - Directory to load API modules from
 * @param {boolean} [options.lazy=false] - Use lazy loading (true) or eager loading (false)
 * @param {number} [options.apiDepth=Infinity] - Maximum directory depth to scan
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {string} [options.mode="singleton"] - Execution mode (singleton, vm, worker, fork)
 * @param {string} [options.api_mode="auto"] - API structure mode (auto, function, object)
 * @param {string} [options.runtime] - Runtime type ("async", "asynclocalstorage", "live", "livebindings", "experimental")
 * @param {boolean} [options.allowApiOverwrite=true] - Allow addApi to overwrite existing API endpoints
 * @param {object} [options.context={}] - Context data for live bindings
 * @param {object} [options.reference={}] - Reference objects to merge into API root
 * @returns {Promise<import("./src/slothlet.mjs").SlothletAPI>} The bound API object with management methods
 *
 * @example // CJS usage
 * const slothlet = require("@cldmv/slothlet");
 * const api = await slothlet({ dir: "./api", context: { user: "alice" } });
 * console.log(api.config.username); // Access configuration
 *
 * @example // CJS usage with runtime selection
 * const slothlet = require("@cldmv/slothlet");
 * const api = await slothlet({ dir: "./api", runtime: "live" });
 *
 * @example // CJS named destructuring
 * const { slothlet } = require("@cldmv/slothlet");
 * const api = await slothlet({ dir: "./api" });
 */
declare function slothlet(options?: {
    dir?: string;
    lazy?: boolean;
    apiDepth?: number;
    debug?: boolean;
    mode?: string;
    api_mode?: string;
    runtime?: string;
    allowApiOverwrite?: boolean;
    context?: object;
    reference?: object;
}): Promise<import("./src/slothlet.mjs").SlothletAPI>;
declare namespace slothlet {
    export { slothlet };
}
//# sourceMappingURL=index.d.cts.map