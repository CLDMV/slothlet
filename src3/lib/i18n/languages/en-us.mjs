/**
 * @fileoverview English (US) translations for Slothlet errors
 * @module @cldmv/slothlet/i18n/en-us
 */

/**
 * English (US) error message translations
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
	INVALID_CONFIG_dir: "Invalid configuration: '{option}' must be {expected}, got {value}. {hint}",
	INVALID_CONFIG_mode: "Invalid configuration: '{option}' must be {expected}, got {value}. {hint}",
	INVALID_CONFIG_runtime: "Invalid configuration: '{option}' must be {expected}, got {value}. {hint}",
	INVALID_CONFIG_generic: "Invalid configuration: '{option}' = '{value}'. Expected: {expected}. {hint}",

	// Module loading errors
	MODULE_LOAD_FAILED: "Failed to load module '{modulePath}' (ID: {moduleId}): {error}",
	MODULE_NO_EXPORTS: "Module '{modulePath}' has no exports. Ensure module exports at least one function or object.",
	MODULE_IMPORT_FAILED: "Failed to import module '{modulePath}': {error}. Check that the file exists and has valid syntax.",
	MODULE_NOT_FOUND: "Module not found: {modulePath}. {hint}",
	MODULE_LOAD_ERROR: "Failed to load module: {modulePath}. Error: {error}. {hint}",
	MODULE_INVALID_EXPORT: "Invalid export '{exportName}' in module '{modulePath}'. Got {exportType}, expected {expected}.",

	// Context errors
	CONTEXT_ALREADY_EXISTS: "Context for instance '{instanceId}' already exists. Cannot initialize twice.",
	CONTEXT_NOT_FOUND: "Context not found for instance '{instanceId}'. Instance may have been shut down.",
	CONTEXT_EXECUTION_FAILED: "Failed to execute in context for instance '{instanceId}': {error}",
	NO_ACTIVE_CONTEXT: "No active context found. This operation requires an active Slothlet instance.",
	NO_ACTIVE_CONTEXT_LIVE: "No active context - no instance is currently active in live bindings mode.",
	NO_ACTIVE_CONTEXT_ASYNC: "No active context - function must be called within slothlet API context.",

	// Runtime errors
	RUNTIME_NO_ACTIVE_CONTEXT_SELF: "No active context - cannot access 'self'. Ensure you're calling from within a Slothlet API function.",
	RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT: "No active context - 'context' can only be modified within slothlet API calls. {hint}",
	RUNTIME_ERROR: "Runtime error in {location}: {error}. {hint}",

	// Ownership errors
	OWNERSHIP_INVALID_MODULE_ID: "Invalid ownership registration: moduleId '{moduleId}' is invalid.",
	OWNERSHIP_INVALID_API_PATH: "Invalid ownership registration: apiPath '{apiPath}' is invalid.",
	OWNERSHIP_CONFLICT:
		"Ownership conflict: Path '{apiPath}' is already owned by module '{existingModuleId}', cannot assign to '{newModuleId}'. Use forceOverwrite: true or removeApi first.",

	// Directory errors
	INVALID_DIRECTORY: "Invalid directory '{dir}': {error}. Ensure the directory exists and is accessible.",

	// Function execution errors
	FUNCTION_EXECUTION_FAILED: "Function at '{apiPath}' threw an error: {originalError}",

	// Internal errors
	INTERNAL_INVALID_STATE: "Internal error: Invalid state detected - {reason}. This is a bug, please report it.",
	INTERNAL_ERROR: "Internal error occurred: {error}",
	INTERNAL_INVALID_ARGUMENT:
		"[INTERNAL ERROR] Function '{functionName}' received invalid argument for parameter '{parameter}'. Got {received}, expected {expected}. This is likely a bug in Slothlet.",

	// Generic
	NOT_IMPLEMENTED: "Feature '{feature}' is not yet implemented. {hint}",

	// Warnings
	WARNING_RESERVED_PROPERTY_CONFLICT: "User API conflicts with reserved properties: {properties}",
	WARNING_LANGUAGE_LOAD_FAILED: "Failed to load language '{lang}', falling back to English.",
	WARNING_LANGUAGE_UNAVAILABLE: "Language '{lang}' is not available, using English.",
	ERROR_RUNTIME_IMPORT_FAILED: "Failed to import runtime for metadata API: {error}",

	// Debug messages
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

	// Hints
	HINT_REFERENCE_REMOVED:
		"The 'reference' export has been removed from '@cldmv/slothlet/runtime'. Reference objects are now merged directly into the API. Access them via 'self.*' instead (e.g., 'self.myRefProperty').",
	HINT_MODULE_NOT_FOUND: "Ensure the module exists and the path is correct. Check for typos in the import statement.",
	HINT_SYNTAX_ERROR:
		"Check for syntax errors in the module file. Common issues: missing brackets, unclosed strings, or invalid JavaScript syntax."
};

/**
 * Language metadata
 * @public
 */
export const metadata = {
	code: "en-us",
	name: "English (US)",
	nativeName: "English (US)"
};
