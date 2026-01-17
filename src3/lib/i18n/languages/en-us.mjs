/**
 * @fileoverview English (US) translations for Slothlet errors
 * @module @cldmv/slothlet/i18n/en-us
 */

/**
 * English (US) error message translations
 * @public
 */
export const translations = {
	// Config errors
	INVALID_CONFIG_dir: "Invalid configuration: '{option}' must be {expected}, got {value}. {hint}",
	INVALID_CONFIG_mode: "Invalid configuration: '{option}' must be {expected}, got {value}. {hint}",
	INVALID_CONFIG_runtime: "Invalid configuration: '{option}' must be {expected}, got {value}. {hint}",
	INVALID_CONFIG_generic: "Invalid configuration: '{option}' = '{value}'. Expected: {expected}. {hint}",

	// Context errors
	CONTEXT_NOT_FOUND: "No active context found for instance {instanceId}. {hint}",
	CONTEXT_ALREADY_EXISTS: "Context already exists for instance {instanceId}. {hint}",
	NO_ACTIVE_CONTEXT: "No active AsyncLocalStorage context found. {hint}",
	CONTEXT_EXECUTION_FAILED: "Execution failed in context '{instanceId}' at path '{apiPath}': {originalError}",

	// Module errors
	MODULE_NOT_FOUND: "Module not found: {modulePath}. {hint}",
	MODULE_LOAD_ERROR: "Failed to load module: {modulePath}. Error: {error}. {hint}",
	MODULE_LOAD_FAILED: "Failed to load module at '{modulePath}': {reason}. {hint}",
	MODULE_NO_EXPORTS: "Module at '{modulePath}' (ID: {moduleId}) has no valid exports. {hint}",
	MODULE_INVALID_EXPORT: "Invalid export '{exportName}' in module '{modulePath}'. Got {exportType}, expected {expected}.",

	// Ownership errors
	OWNERSHIP_CONFLICT:
		"Cannot add API at '{apiPath}': already owned by module '{currentOwner}'. Attempting to add from module '{newOwner}'. {hint}",
	OWNERSHIP_INVALID_MODULE_ID: "Invalid module ID: {moduleId}. Module ID must be a non-empty string.",
	OWNERSHIP_INVALID_API_PATH: "Invalid API path: {apiPath}. API path must be a non-empty string.",

	// Directory errors
	INVALID_DIRECTORY: "Invalid directory '{dir}': {reason}. Ensure the directory exists and is accessible.",

	// Function execution errors
	FUNCTION_EXECUTION_FAILED: "Function at '{apiPath}' threw an error: {originalError}",

	// Runtime errors
	RUNTIME_ERROR: "Runtime error in {location}: {error}. {hint}",

	// Internal errors
	INTERNAL_INVALID_ARGUMENT:
		"[INTERNAL ERROR] Function '{functionName}' received invalid argument for parameter '{parameter}'. Got {received}, expected {expected}. This is likely a bug in Slothlet.",
	INTERNAL_INVALID_STATE: "[INTERNAL ERROR] Invalid state: {message}. State: {state}. This is likely a bug in Slothlet.",
	INTERNAL_ERROR: "Internal error: {message}. {hint}",

	// Generic
	NOT_IMPLEMENTED: "Feature '{feature}' is not yet implemented. {hint}",

	// Warnings
	WARNING_RESERVED_PROPERTY_CONFLICT: "User API conflicts with reserved properties: {properties}",
	WARNING_LANGUAGE_LOAD_FAILED: "Failed to load language '{lang}', falling back to en-us",
	WARNING_LANGUAGE_UNAVAILABLE: "Language '{lang}' not available, using 'en-us'",
	ERROR_RUNTIME_IMPORT_FAILED: "Failed to import runtime for metadata API: {error}",

	// Runtime binding errors
	RUNTIME_NO_ACTIVE_CONTEXT_SELF: "No active context - 'self' can only be accessed within slothlet API calls. {hint}",
	RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT: "No active context - 'context' can only be modified within slothlet API calls. {hint}",

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
	DEBUG_MODE_DIRECTORY: "[{mode}] Processing directory: {dirPath}"
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
