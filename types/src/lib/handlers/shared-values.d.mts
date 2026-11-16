/**
 * Whether a value was recorded as made by no module (see {@link recordSharedExports}).
 * @param {*} value - Candidate value.
 * @returns {boolean} True when recorded.
 * @internal
 * @example
 * isSharedExport(EventEmitter); // true
 */
export function isSharedExport(value: any): boolean;
/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
export { guarded_recordSharedExports as recordSharedExports };
/** @type {typeof recordSharedExports} */
declare const guarded_recordSharedExports: typeof recordSharedExports;
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
declare function recordSharedExports(value: any): void;
//# sourceMappingURL=shared-values.d.mts.map