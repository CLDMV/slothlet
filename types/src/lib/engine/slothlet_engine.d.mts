/**
 * Sets the shutdown function for the engine.
 * @param {Function} fn - Shutdown function to set
 * @returns {Function} Previously set shutdown function
 * @example
 * const prev = setShutdown(() => console.log('Shutting down'));
 */
export function setShutdown(fn: Function): Function;
/**
 * Creates a slothlet engine with the specified mode and options.
 * @param {object} allOptions - Engine configuration options
 * @param {string} allOptions.entry - Entry point for the slothlet module
 * @param {string} [allOptions.mode="vm"] - Engine mode: "vm", "worker", "fork", or "child"
 * @param {object} [allOptions.context] - Context object for modules
 * @param {object} [allOptions.reference] - Reference object for modules
 * @returns {Promise<object>} Engine instance with API and shutdown capabilities
 * @example
 * const engine = await createEngine({
 *   entry: './api/index.mjs',
 *   mode: 'vm',
 *   context: { user: 'alice' }
 * });
 */
export function createEngine(allOptions: {
    entry: string;
    mode?: string;
    context?: object;
    reference?: object;
}): Promise<object>;
export function makeFacade2(portal: any): () => void;
//# sourceMappingURL=slothlet_engine.d.mts.map