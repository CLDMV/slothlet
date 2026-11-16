/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof enableSchedulerPatching} */
declare const guarded_enableSchedulerPatching: typeof enableSchedulerPatching;
/** @type {typeof disableSchedulerPatching} */
declare const guarded_disableSchedulerPatching: typeof disableSchedulerPatching;
/**
 * Pin deferred callbacks to the module that schedules them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how
 * EventEmitter patching behaves. Costs nothing when no runtime registered a pinning strategy — the
 * wrapper hands the callback straight through.
 *
 * @returns {void}
 * @public
 */
declare function enableSchedulerPatching(): void;
/**
 * Restore the original scheduler entry points.
 *
 * Restores an entry point only when the wrapper installed here is still the one in place. Anything
 * that replaced a scheduler afterwards — a test runner's fake timers being the usual case — owns that
 * slot and its own restore, and writing over it would strand the process on a stale function. A
 * wrapper left in place that way passes through from then on, and a restore puts back what is under
 * every such wrapper, so copies of slothlet that unpatch out of order still restore the original.
 *
 * @returns {void}
 * @public
 */
declare function disableSchedulerPatching(): void;
export { guarded_enableSchedulerPatching as enableSchedulerPatching, guarded_disableSchedulerPatching as disableSchedulerPatching };
//# sourceMappingURL=scheduler-context.d.mts.map