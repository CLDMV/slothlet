/**
 * Builds final API with built-in methods attached
 * @class ApiBuilder
 * @extends ComponentBase
 * @package
 *
 * @description
 * Class-based builder for final API construction with built-in namespace attachment.
 * Extends ComponentBase for common Slothlet property access.
 *
 * @example
 * const builder = new ApiBuilder(slothlet);
 * const api = await builder.buildFinalAPI(userApi);
 */
export class ApiBuilder extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create an ApiBuilder instance.
     * @param {object} slothlet - Slothlet class instance.
     * @package
     *
     * @description
     * Creates ApiBuilder with ComponentBase support for config, debug, instanceID access.
     */
    constructor(slothlet: object);
    /**
     * Build final API with built-in methods attached
     * @param {Object} userApi - User API object from mode builder
     * @returns {Promise<Object>} Final API with built-ins attached
     * @public
     */
    public buildFinalAPI(userApi: any): Promise<any>;
    /**
     * @param {object} userApi - User API object (for diagnostics).
     * @returns {Promise<object>} Slothlet namespace object.
     * @private
     *
     * @description
     * Builds the slothlet namespace with version metadata, API controls, and lifecycle
     * helpers for the current instance.
     *
     * @example
     * const namespace = await this.createSlothletNamespace(api);
     */
    private createSlothletNamespace;
    /**
     * Create root-level shutdown function (convenience)
     * @returns {Function} Shutdown function that dynamically calls user hooks
     * @private
     */
    private createShutdownFunction;
    /**
     * Create root-level run function (per-request context isolation)
     * @returns {Function} Run function that executes callbacks with isolated context
     * @private
     */
    private createRunFunction;
    /**
     * Create root-level scope function (structured per-request context with options)
     * @returns {Function} Scope function that executes functions with isolated context
     * @private
     */
    private createScopeFunction;
    /**
     * Create root-level destroy function (permanent destruction)
     * @param {Object} api - Full API object
     * @returns {Function} Destroy function that dynamically calls user hooks
     * @private
     */
    private createDestroyFunction;
    /**
     * Attach built-in methods to user API
     * @param {Object} userApi - User API object
     * @param {Object} builtins - Built-in methods to attach
     * @private
     */
    private attachBuiltins;
}
/**
 * i18n translation helpers exposed on every Slothlet namespace.
 */
export type I18nNamespace = {
    /**
     * - Set the active locale (e.g. "en-us").
     */
    setLanguage: Function;
    /**
     * - Return the current active locale string.
     */
    getLanguage: Function;
    /**
     * - Translate an error code with optional params.
     */
    translate: Function;
    /**
     * - Alias for translate.
     */
    t: Function;
    /**
     * - Initialise the i18n system with options.
     */
    initI18n: Function;
};
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=api_builder.d.mts.map