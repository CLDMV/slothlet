/**
 * @fileoverview Configuration normalization utilities
 * @module @cldmv/slothlet/helpers/config
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { resolvePathFromCaller } from "@cldmv/slothlet/helpers/resolve-from-caller";

/**
 * Normalize runtime input to internal standard format
 * @param {string} runtime - Input runtime type (various formats accepted)
 * @returns {string} Normalized runtime type ("async" or "live")
 * @public
 */
export function normalizeRuntime(runtime) {
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
export function normalizeMode(mode) {
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
export function normalizeDebug(debug) {
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
export function transformConfig(config = {}) {
	// Validate required fields
	if (!config.dir) {
		throw new SlothletError("INVALID_CONFIG_DIR_MISSING", {}, null, { validationError: true });
	}

	// Resolve relative paths from caller's context
	const resolvedDir = resolvePathFromCaller(config.dir);

	// Build normalized config
	return {
		dir: resolvedDir,
		mode: normalizeMode(config.mode),
		runtime: normalizeRuntime(config.runtime),
		reference: config.reference || null,
		context: config.context || null,
		debug: normalizeDebug(config.debug),
		...config
	};
}
