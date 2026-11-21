/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof enableObserverPatching} */
declare const guarded_enableObserverPatching: typeof enableObserverPatching;
/** @type {typeof disableObserverPatching} */
declare const guarded_disableObserverPatching: typeof disableObserverPatching;
/**
 * Pin observer callbacks to the module that constructs them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how the
 * other boundary patches behave. An observer constructed while an instance on the async runtime is up gets an
 * `AsyncResource` to carry that runtime's store into its callback, as a listener does; the live runtime alone makes none.
 *
 * @returns {void}
 * @public
 */
declare function enableObserverPatching(): void;
/**
 * Restore the original observer constructors.
 *
 * Restores a constructor only when the wrapper installed here is still in place, so anything that
 * replaced it afterwards keeps ownership of its own restore. A wrapper left in place passes through
 * from then on, and a restore puts back what is under every such wrapper (see boundary-patch-layers).
 *
 * @returns {void}
 * @public
 */
declare function disableObserverPatching(): void;
export { guarded_enableObserverPatching as enableObserverPatching, guarded_disableObserverPatching as disableObserverPatching };
//# sourceMappingURL=observer-context.d.mts.map