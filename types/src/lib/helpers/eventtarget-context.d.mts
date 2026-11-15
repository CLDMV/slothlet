/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof enableEventTargetPatching} */
declare const guarded_enableEventTargetPatching: typeof enableEventTargetPatching;
/** @type {typeof disableEventTargetPatching} */
declare const guarded_disableEventTargetPatching: typeof disableEventTargetPatching;
/**
 * Enable context propagation through `EventTarget` listeners.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how
 * EventEmitter patching behaves.
 *
 * @returns {void}
 * @public
 */
declare function enableEventTargetPatching(): void;
/**
 * Restore the original `EventTarget` methods.
 *
 * Restores a method only when the patch installed here is still in place, so anything that replaced
 * it afterwards keeps ownership of its own restore. A patch left in place passes through from then
 * on, and a restore puts back what is under every such patch (see boundary-patch-layers).
 *
 * @returns {void}
 * @public
 */
declare function disableEventTargetPatching(): void;
export { guarded_enableEventTargetPatching as enableEventTargetPatching, guarded_disableEventTargetPatching as disableEventTargetPatching };
//# sourceMappingURL=eventtarget-context.d.mts.map