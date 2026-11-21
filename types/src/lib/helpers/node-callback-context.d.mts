/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof enableNodeCallbackPatching} */
declare const guarded_enableNodeCallbackPatching: typeof enableNodeCallbackPatching;
/** @type {typeof disableNodeCallbackPatching} */
declare const guarded_disableNodeCallbackPatching: typeof disableNodeCallbackPatching;
/** @type {typeof enableAsyncCallbackServing} */
declare const guarded_enableAsyncCallbackServing: typeof enableAsyncCallbackServing;
/** @type {typeof disableAsyncCallbackServing} */
declare const guarded_disableAsyncCallbackServing: typeof disableAsyncCallbackServing;
/**
 * Pin the callbacks of Node's callback-style APIs to the flow and caller that handed them in.
 *
 * Called when an instance on the live runtime is created; later calls are ignored. Does nothing where the builtins are
 * absent (a browser).
 *
 * @returns {void}
 * @public
 * @example
 * enableNodeCallbackPatching();
 */
declare function enableNodeCallbackPatching(): void;
/**
 * Put back what {@link enableNodeCallbackPatching} replaced, where its wrapper is still the one in place, last installed
 * first. A wrapper something else has since covered passes through from then on.
 * @returns {void}
 * @public
 * @example
 * disableNodeCallbackPatching();
 */
declare function disableNodeCallbackPatching(): void;
/**
 * Deliver the callbacks of the functions in {@link BATCHED} through `process.nextTick()`, in the async context they
 * were handed in, so overlapping calls in different flows each see their own.
 *
 * Called when an instance on the async runtime is created; later calls are ignored. Does nothing where the builtins
 * are absent (a browser).
 *
 * @returns {void}
 * @public
 * @example
 * enableAsyncCallbackServing();
 */
declare function enableAsyncCallbackServing(): void;
/**
 * Take back what {@link enableAsyncCallbackServing} added: a wrapper left with nothing to do is removed as
 * {@link disableNodeCallbackPatching} removes one.
 * @returns {void}
 * @public
 * @example
 * disableAsyncCallbackServing();
 */
declare function disableAsyncCallbackServing(): void;
export { guarded_enableNodeCallbackPatching as enableNodeCallbackPatching, guarded_disableNodeCallbackPatching as disableNodeCallbackPatching, guarded_enableAsyncCallbackServing as enableAsyncCallbackServing, guarded_disableAsyncCallbackServing as disableAsyncCallbackServing };
//# sourceMappingURL=node-callback-context.d.mts.map