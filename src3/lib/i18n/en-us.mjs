/**
 * @fileoverview English (US) translations for Slothlet errors
 * @module @cldmv/slothlet/i18n/en-us
 */

/**
 * English translations map
 * @public
 */
export const translations = {
	// Configuration errors
	INVALID_CONFIG: "Invalid configuration: {option} is {value}, expected {expected}. {hint}",
	INVALID_CONFIG_DIR_MISSING: "Configuration error: 'dir' option is required. Provide a directory path to load API from.",
	INVALID_CONFIG_DIR_INVALID: "Configuration error: 'dir' must be a non-empty string path. Received: {value}",
	INVALID_CONFIG_MODE_INVALID: "Configuration error: 'mode' must be either 'eager' or 'lazy'. Received: {value}",
	INVALID_CONFIG_MODE_UNKNOWN: "Unknown loading mode '{mode}'. Supported modes: 'eager', 'lazy'",
	INVALID_CONFIG_NOT_LOADED: "Cannot perform operation '{operation}' - instance not loaded. Call load() first.",
	INVALID_CONFIG_RELOAD_NOT_IMPL: "Reload functionality not yet implemented. This will be added in a future iteration.",
	INVALID_CONFIG_LAZY_NOT_READY: "Cannot call function directly in lazy mode - access properties to trigger materialization first.",
	INVALID_CONFIG_LAZY_ASYNC_REQUIRED: "Lazy mode requires async operations. Use eager mode for now or implement async getter pattern.",

	// Module loading errors
	MODULE_LOAD_FAILED: "Failed to load module '{modulePath}' (ID: {moduleId}): {error}",
	MODULE_NO_EXPORTS: "Module '{modulePath}' has no exports. Ensure module exports at least one function or object.",
	MODULE_IMPORT_FAILED: "Failed to import module '{modulePath}': {error}. Check that the file exists and has valid syntax.",

	// Context errors
	CONTEXT_ALREADY_EXISTS: "Context for instance '{instanceId}' already exists. Cannot initialize twice.",
	CONTEXT_NOT_FOUND: "Context not found for instance '{instanceId}'. Instance may have been shut down.",
	CONTEXT_EXECUTION_FAILED: "Failed to execute in context for instance '{instanceId}': {error}",
	NO_ACTIVE_CONTEXT: "No active context found. This operation requires an active Slothlet instance.",
	NO_ACTIVE_CONTEXT_LIVE: "No active context - no instance is currently active in live bindings mode.",
	NO_ACTIVE_CONTEXT_ASYNC: "No active context - function must be called within slothlet API context.",

	// Runtime errors
	RUNTIME_NO_ACTIVE_CONTEXT_SELF: "No active context - cannot access 'self'. Ensure you're calling from within a Slothlet API function.",

	// Ownership errors
	OWNERSHIP_INVALID_MODULE_ID: "Invalid ownership registration: moduleId '{moduleId}' is invalid.",
	OWNERSHIP_INVALID_API_PATH: "Invalid ownership registration: apiPath '{apiPath}' is invalid.",
	OWNERSHIP_CONFLICT:
		"Ownership conflict: Path '{apiPath}' is already owned by module '{existingModuleId}', cannot assign to '{newModuleId}'. Use forceOverwrite: true or removeApi first.",

	// Internal errors
	INTERNAL_INVALID_STATE: "Internal error: Invalid state detected - {reason}. This is a bug, please report it.",
	INTERNAL_ERROR: "Internal error occurred: {error}",

	// Debug/info messages
	DEBUG_MODE_ROOT_FILE: "[{mode}] Processing root file: {moduleName}",
	DEBUG_MODE_ROOT_CONTRIBUTOR: "[{mode}] Root contributor detected: {functionName}",
	DEBUG_MODE_ROOT_CONTRIBUTOR_APPLIED: "[{mode}] Root contributor pattern applied - function API with {properties} additional properties",
	DEBUG_MODE_NESTED_FILE: "[{mode}] Processing nested file: {apiPath}",
	DEBUG_MODE_PROCESSING_DIRECTORY: "[{mode}] Processing directory: {categoryName} (depth {currentDepth})",
	DEBUG_MODE_MODULE_DECISION: "[{mode}] Module {moduleName}: {reason}",
	DEBUG_MODE_FLATTENING: "[{mode}] Flattening {moduleName}: {flattenType}",
	DEBUG_MODE_FOLDER_MATCH:
		"[{mode}] Folder/folder.mjs check: moduleName={moduleName}, categoryName={categoryName}, hasAssignment={hasAssignment}, keys={assignmentKeys}",
	DEBUG_MODE_FOLDER_DEFAULT: "[{mode}] Folder/folder.mjs pattern: {categoryName}/{moduleName} - using default export as category",
	DEBUG_MODE_DIRECTORY: "[{mode}] Processing directory: {dirPath}",

	// Warnings
	WARNING_LANGUAGE_LOAD_FAILED: "Failed to load language '{lang}', falling back to English.",
	WARNING_LANGUAGE_UNAVAILABLE: "Language '{lang}' is not available, using English."
};
