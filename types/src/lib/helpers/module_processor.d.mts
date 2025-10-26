/**
 * @fileoverview Unified module processing logic for slothlet modes. Internal file (not exported in package.json).
 * @module @cldmv/slothlet/src/lib/helpers/module_processor
 */
/**
 * Processes a single module and applies it to the API based on multi-default context and export patterns.
 * @internal
 * @private
 * @param {object} options - Processing configuration
 * @param {object} options.mod - The loaded and unwrapped module
 * @param {string} options.fileName - The base filename (without extension)
 * @param {string} options.apiKey - The sanitized API key for this module
 * @param {boolean} options.hasMultipleDefaultExports - Whether multi-default context is active
 * @param {boolean} options.isSelfReferential - Whether this module's default is self-referential
 * @param {object} options.api - The API object to modify
 * @param {Function|null} options.getRootDefault - Function to get current root default
 * @param {Function} options.setRootDefault - Function to set root default
 * @param {object} options.context - Processing context (debug, mode-specific data)
 * @param {boolean} [options.context.debug=false] - Enable debug logging
 * @param {string} [options.context.mode="unknown"] - Processing mode (eager/lazy)
 * @param {Array<object>} [options.context.moduleFiles=[]] - All module files for context
 * @returns {{
 *   processed: boolean,
 *   rootDefaultSet: boolean,
 *   flattened: boolean,
 *   namespaced: boolean
 * }} Processing result metadata
 * @example // Internal usage in slothlet modes
 * const result = processModule({
 *   mod, fileName, apiKey, hasMultipleDefaultExports, isSelfReferential,
 *   api, getRootDefault: () => rootFn, setRootDefault: (fn) => { rootFn = fn; },
 *   context: { debug: true, mode: "eager" }
 * });
 */
export function processModule(options: {
    mod: object;
    fileName: string;
    apiKey: string;
    hasMultipleDefaultExports: boolean;
    isSelfReferential: boolean;
    api: object;
    getRootDefault: Function | null;
    setRootDefault: Function;
    context: {
        debug?: boolean;
        mode?: string;
        moduleFiles?: Array<object>;
    };
}): {
    processed: boolean;
    rootDefaultSet: boolean;
    flattened: boolean;
    namespaced: boolean;
};
//# sourceMappingURL=module_processor.d.mts.map