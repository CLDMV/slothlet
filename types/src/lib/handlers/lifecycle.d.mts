/**
 * Lifecycle event manager for impl changes
 * @extends ComponentBase
 * @public
 */
export class Lifecycle extends ComponentBase {
    /**
     * Where this component should be mounted on the Slothlet instance
     * @type {string}
     */
    static slothletProperty: string;
    /**
     * @param {object} slothlet - Slothlet instance
     */
    constructor(slothlet: object);
    subscribers: Map<any, any>;
    eventLog: any[];
    maxLogSize: number;
    /**
     * Subscribe to lifecycle event
     * @param {string} event - Event name (impl:created, impl:changed, impl:removed, materialized:complete, path:collision)
     * @param {Function} handler - Event handler function(eventData)
     * @returns {Function} Unsubscribe function
     * @public
     *
     * @description
     * Subscribe to lifecycle events to react to impl changes.
     *
     * @example
     * const unsubscribe = lifecycle.subscribe("impl:changed", (data) => {
     *   console.log("Impl changed:", data.apiPath, data.source);
     * });
     */
    public subscribe(event: string, handler: Function): Function;
    /**
     * Alias for subscribe() - standard EventEmitter pattern
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @returns {Function} Unsubscribe function
     * @public
     *
     * @example
     * lifecycle.on('materialized:complete', (data) => {
     *   console.log(`${data.total} modules materialized`);
     * });
     */
    public on(event: string, handler: Function): Function;
    /**
     * Unsubscribe from lifecycle event - standard EventEmitter pattern
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function to remove
     * @public
     *
     * @example
     * const handler = (data) => console.log(data);
     * lifecycle.on('impl:changed', handler);
     * lifecycle.off('impl:changed', handler);
     */
    public off(event: string, handler: Function): void;
    /**
     * Alias for off() - standard EventEmitter pattern
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function to remove
     * @public
     */
    public unsubscribe(event: string, handler: Function): void;
    /**
     * Emit lifecycle event
     * @param {string} event - Event name
     * @param {object} data - Event data
     * @private
     *
     * @description
     * Emit event to all subscribers. Event data should include:
     * - apiPath: API path where impl exists
     * - impl: The implementation object
     * - source: Source of event (initial, hot-reload, materialization, etc)
     * - moduleID: Module identifier (if applicable)
     * - filePath: File path (if applicable)
     * - metadata: Additional metadata
     *
     * @example
     * lifecycle.emit("impl:created", {
     *   apiPath: "math.add",
     *   impl: addFunction,
     *   source: "initial",
     *   moduleID: "base_abc123",
     *   filePath: "/path/to/math.mjs"
     * });
     */
    private emit;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=lifecycle.d.mts.map