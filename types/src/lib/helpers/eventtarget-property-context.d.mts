/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof enableEventTargetPropertyPatching} */
declare const guarded_enableEventTargetPropertyPatching: typeof enableEventTargetPropertyPatching;
/** @type {typeof disableEventTargetPropertyPatching} */
declare const guarded_disableEventTargetPropertyPatching: typeof disableEventTargetPropertyPatching;
/**
 * Pin `on*` handler assignments to the module that makes them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how the
 * other boundary patches behave. Costs nothing when no runtime registered a pinning strategy — the
 * wrapper hands the callback straight through.
 *
 * @returns {void}
 * @public
 */
declare function enableEventTargetPropertyPatching(): void;
/**
 * Restore the original `on*` handler accessors.
 *
 * Restores an accessor only when the patch installed here is still in place, so anything that replaced
 * it afterwards keeps ownership of its own restore. An accessor left in place passes through from then
 * on, and a restore puts back what is under every such accessor (see boundary-patch-layers).
 *
 * @returns {void}
 * @public
 */
declare function disableEventTargetPropertyPatching(): void;
export { guarded_enableEventTargetPropertyPatching as enableEventTargetPropertyPatching, guarded_disableEventTargetPropertyPatching as disableEventTargetPropertyPatching };
//# sourceMappingURL=eventtarget-property-context.d.mts.map