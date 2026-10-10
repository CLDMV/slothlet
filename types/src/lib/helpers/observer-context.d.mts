/**
 * Pin observer callbacks to the module that constructs them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how the
 * other boundary patches behave. Costs nothing when no runtime registered a pinning strategy — the
 * wrapper hands the callback straight through.
 *
 * @returns {void}
 * @public
 */
export function enableObserverPatching(): void;
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
export function disableObserverPatching(): void;
//# sourceMappingURL=observer-context.d.mts.map