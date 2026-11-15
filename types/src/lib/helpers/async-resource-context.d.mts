/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof enableAsyncResourcePatching} */
declare const guarded_enableAsyncResourcePatching: typeof enableAsyncResourcePatching;
/** @type {typeof disableAsyncResourcePatching} */
declare const guarded_disableAsyncResourcePatching: typeof disableAsyncResourcePatching;
/**
 * Carry the creating module's identity into what async snapshots, bindings and resources run later.
 *
 * Called when an instance on the live runtime is created; later calls are ignored. Does nothing where
 * `node:async_hooks` is absent (a browser).
 *
 * @returns {void}
 * @public
 * @example
 * enableAsyncResourcePatching();
 */
declare function enableAsyncResourcePatching(): void;
/**
 * Put back what {@link enableAsyncResourcePatching} replaced, where its wrapper is still the one in place. A wrapper
 * something else has since covered passes through from then on.
 * @returns {void}
 * @public
 * @example
 * disableAsyncResourcePatching();
 */
declare function disableAsyncResourcePatching(): void;
export { guarded_enableAsyncResourcePatching as enableAsyncResourcePatching, guarded_disableAsyncResourcePatching as disableAsyncResourcePatching };
//# sourceMappingURL=async-resource-context.d.mts.map