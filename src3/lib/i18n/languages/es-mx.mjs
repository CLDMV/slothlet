/**
 * @fileoverview Spanish (Mexico) translations for Slothlet errors
 * @module @cldmv/slothlet/i18n/es-mx
 */

/**
 * Spanish (Mexico) error message translations
 * @public
 */
export const translations = {
	// Config errors
	INVALID_CONFIG_dir: "Configuración inválida: '{option}' debe ser {expected}, se recibió {value}. {hint}",
	INVALID_CONFIG_mode: "Configuración inválida: '{option}' debe ser {expected}, se recibió {value}. {hint}",
	INVALID_CONFIG_runtime: "Configuración inválida: '{option}' debe ser {expected}, se recibió {value}. {hint}",
	INVALID_CONFIG_generic: "Configuración inválida: '{option}' = '{value}'. Esperado: {expected}. {hint}",

	// Context errors
	CONTEXT_NOT_FOUND: "No se encontró contexto activo para la instancia {instanceId}. {hint}",
	CONTEXT_ALREADY_EXISTS: "Ya existe un contexto para la instancia {instanceId}. {hint}",
	NO_ACTIVE_CONTEXT: "No se encontró contexto de AsyncLocalStorage activo. {hint}",
	CONTEXT_EXECUTION_FAILED: "Falló la ejecución en el contexto '{instanceId}' en la ruta '{apiPath}': {originalError}",

	// Module errors
	MODULE_NOT_FOUND: "Módulo no encontrado: {modulePath}. {hint}",
	MODULE_LOAD_ERROR: "Error al cargar el módulo: {modulePath}. Error: {error}. {hint}",
	MODULE_LOAD_FAILED: "Error al cargar el módulo en '{modulePath}': {reason}. {hint}",
	MODULE_NO_EXPORTS: "El módulo en '{modulePath}' (ID: {moduleId}) no tiene exportaciones válidas. {hint}",
	MODULE_INVALID_EXPORT:
		"Exportación inválida '{exportName}' en el módulo '{modulePath}'. Se recibió {exportType}, se esperaba {expected}.",

	// Ownership errors
	OWNERSHIP_CONFLICT:
		"No se puede agregar API en '{apiPath}': ya es propiedad del módulo '{currentOwner}'. Intentando agregar desde el módulo '{newOwner}'. {hint}",
	OWNERSHIP_INVALID_MODULE_ID: "ID de módulo inválido: {moduleId}. El ID del módulo debe ser una cadena no vacía.",
	OWNERSHIP_INVALID_API_PATH: "Ruta de API inválida: {apiPath}. La ruta de API debe ser una cadena no vacía.",

	// Directory errors
	INVALID_DIRECTORY: "Directorio inválido '{dir}': {reason}. Asegúrese de que el directorio existe y es accesible.",

	// Function execution errors
	FUNCTION_EXECUTION_FAILED: "La función en '{apiPath}' lanzó un error: {originalError}",

	// Runtime errors
	RUNTIME_ERROR: "Error de ejecución en {location}: {error}. {hint}",

	// Internal errors
	INTERNAL_INVALID_ARGUMENT:
		"[ERROR INTERNO] La función '{functionName}' recibió un argumento inválido para el parámetro '{parameter}'. Se recibió {received}, se esperaba {expected}. Esto probablemente es un error en Slothlet.",
	INTERNAL_INVALID_STATE: "[ERROR INTERNO] Estado inválido: {message}. Estado: {state}. Esto probablemente es un error en Slothlet.",
	INTERNAL_ERROR: "Error interno: {message}. {hint}",

	// Generic
	NOT_IMPLEMENTED: "La función '{feature}' aún no está implementada. {hint}"
};

/**
 * Language metadata
 * @public
 */
export const metadata = {
	code: "es-mx",
	name: "Spanish (Mexico)",
	nativeName: "Español (México)"
};
