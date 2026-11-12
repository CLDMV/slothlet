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
export function enableAsyncResourcePatching(): void;
/**
 * Put back what {@link enableAsyncResourcePatching} replaced, where its wrapper is still the one in place. A wrapper
 * something else has since covered passes through from then on.
 * @returns {void}
 * @public
 * @example
 * disableAsyncResourcePatching();
 */
export function disableAsyncResourcePatching(): void;
//# sourceMappingURL=async-resource-context.d.mts.map