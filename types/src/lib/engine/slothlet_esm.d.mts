/**
 * Minimal custom ESM loader for VM context fallback when SourceTextModule is unavailable.
 * Parses import/export statements, loads dependencies recursively, and evaluates code in context.
 * Limitations: Only supports static imports/exports, no top-level await, no dynamic import, no advanced ESM features.
 * @param {object} context - The VM context.
 * @param {string} fileUrl - The file URL to load.
 * @param {Set<string>} [visited] - Tracks loaded modules to prevent cycles.
 * @returns {Promise<object>} Module namespace object.
 * @example
 * const ns = await loadEsmModuleFallback(context, 'file:///path/to/mod.mjs');
 */
export function loadEsmModuleFallback(context: object, fileUrl: string, visited?: Set<string>): Promise<object>;
/**
 * Detects if a file is ESM based on extension or code content.
 * @param {string} fileUrl
 * @returns {Promise<boolean>}
 */
export function isEsmFile(fileUrl: string): Promise<boolean>;
//# sourceMappingURL=slothlet_esm.d.mts.map