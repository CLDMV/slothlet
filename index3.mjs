/**
 * @fileoverview ESM entry point for @cldmv/slothlet with automatic source/dist detection and live-binding context.
 * @module @cldmv/slothlet
 */

// Custom uncaught exception handler for SlothletError
process.on("uncaughtException", (error) => {
	if (error.name === "SlothletError") {
		console.error("\n================================================================================");
		console.error(`ERROR [${error.code}]: ${error.message}`);

		// Extract and show file/line from original error stack if available
		const stackToUse = error.originalError?.stack || error.stack;
		if (stackToUse) {
			const stackLines = stackToUse.split("\n");
			// For import errors, try to extract from the error message first (more accurate)
			if (
				error.originalError?.message?.includes("does not provide an export") ||
				error.originalError?.message?.includes("Cannot find module")
			) {
				// Extract file path from context (modulePath is the file that failed to import)
				const failedFile = error.context?.modulePath;
				if (failedFile) {
					console.error(`\n📍 Location: ${failedFile} (import statement)`);
				}
			} else {
				// Otherwise extract from stack trace
				const firstStackLine = stackLines[1]; // First line after error message
				if (firstStackLine) {
					// Extract file:line info from stack trace (format: "at function (file:line:col)")
					const match = firstStackLine.match(/\((.+?):(\d+):(\d+)\)/) || firstStackLine.match(/at (.+?):(\d+):(\d+)/);
					if (match) {
						console.error(`\n📍 Location: ${match[1]}:${match[2]}`);
					}
				}
			}
		}

		if (error.hint) {
			console.error("\n💡 Hint:");
			console.error(`  ${error.hint}`);
		}

		// Show minimal context (filter out error/hint/originalError which are already shown)
		const contextKeys = Object.keys(error.context || {}).filter((k) => k !== "error" && k !== "hint" && k !== "originalError");
		if (contextKeys.length > 0) {
			console.error("\nDetails:");
			for (const key of contextKeys) {
				const value = error.context[key];
				const displayValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
				console.error(`  ${key}: ${displayValue}`);
			}
		}

		// Show clean stack trace (prefer original error's stack)
		const stackForDisplay = error.originalError?.stack || error.stack;
		if (stackForDisplay) {
			console.error("\nStack Trace:");
			const stackLines = stackForDisplay.split("\n").slice(1); // Skip first line (error message)
			for (const line of stackLines) {
				console.error(`  ${line.trim()}`);
			}
		}

		console.error("================================================================================\n");
		process.exit(1);
	}

	// Re-throw other errors to let Node.js handle them
	throw error;
});

// Development environment check (must happen before slothlet imports)
const devcheckPromise = (async () => {
	try {
		await import("@cldmv/slothlet/devcheck");
	} catch {
		// ignore
	}
})();

/**
 * Creates a slothlet API instance with live-binding context and AsyncLocalStorage support.
 * Automatically wraps all API functions with context isolation for multi-instance support.
 * @public
 * @async
 *
 * @param {object} [options={}] - Configuration options for the slothlet instance
 * @param {string} [options.dir="api"] - Directory to load API modules from
 * @param {boolean} [options.lazy=false] - Use lazy loading (true) or eager loading (false) - legacy option
 * @param {string} [options.mode] - Loading mode ("lazy", "eager") or execution mode ("singleton", "vm", "worker", "fork") - takes precedence over lazy option
 * @param {string} [options.engine="singleton"] - Execution mode (singleton, vm, worker, fork)
 * @param {number} [options.apiDepth=Infinity] - Maximum directory depth to scan
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {string} [options.api_mode="auto"] - API structure mode (auto, function, object)
 * @param {boolean} [options.allowApiOverwrite=true] - Allow addApi to overwrite existing API endpoints
 * @param {object} [options.context={}] - Context data for live bindings
 * @param {object} [options.reference={}] - Reference objects to merge into API root
 * @returns {Promise<import("./src/slothlet.mjs").SlothletAPI>} The bound API object with management methods
 *
 * @example // ESM
 * import slothlet from "@cldmv/slothlet";
 * const api = await slothlet({ dir: './api', lazy: true });
 * const result = await api.math.add(2, 3); // 5
 *
 */
export default async function slothlet(options = {}) {
	// Wait for devcheck to complete before proceeding
	await devcheckPromise;

	console.log("DEBUG index3.mjs: loading slothlet from @cldmv/slothlet/slothlet");

	// Dynamic imports after environment check
	const mod = await import("@cldmv/slothlet/slothlet");

	const slothlet = mod.slothlet ?? mod.default;

	console.log("DEBUG index3.mjs: loaded slothlet, calling it now");

	return slothlet(options);
}

/**
 * Named export alias for the default slothlet function.
 * Provides the same functionality as the default export.
 * @public
 * @type {Function}
 *
 * @example // ESM named import
 * import { slothlet } from "@cldmv/slothlet";
 * const api = await slothlet({ dir: './api' });
 */
// Optional named alias
export { slothlet };
