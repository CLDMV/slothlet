/**
 * Record a value made by no module, and everything it reaches through own members, accessors and prototypes, read by
 * descriptor so no getter runs, up to {@link RECORD_BUDGET} properties. A Proxy is passed over, and the language's own
 * prototypes end the walk.
 * @param {*} value - The value.
 * @returns {void}
 * @internal
 * @example
 * recordSharedExports(globalThis.process.getBuiltinModule("node:events"));
 */
export function recordSharedExports(value: any): void;
/**
 * Whether a value was recorded as made by no module (see {@link recordSharedExports}).
 * @param {*} value - Candidate value.
 * @returns {boolean} True when recorded.
 * @internal
 * @example
 * isSharedExport(EventEmitter); // true
 */
export function isSharedExport(value: any): boolean;
//# sourceMappingURL=shared-values.d.mts.map