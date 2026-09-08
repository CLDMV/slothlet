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
export function enableEventTargetPropertyPatching(): void;
/**
 * Restore the original `on*` handler accessors.
 *
 * Restores an accessor only when the patch installed here is still in place, so anything that replaced
 * it afterwards keeps ownership of its own restore.
 *
 * @returns {void}
 * @public
 */
export function disableEventTargetPropertyPatching(): void;
//# sourceMappingURL=eventtarget-property-context.d.mts.map