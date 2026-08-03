/**
 * Enable context propagation through `EventTarget` listeners.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how
 * EventEmitter patching behaves.
 *
 * @returns {void}
 * @public
 */
export function enableEventTargetPatching(): void;
/**
 * Restore the original `EventTarget` methods.
 *
 * Restores a method only when the patch installed here is still in place, so anything that replaced
 * it afterwards keeps ownership of its own restore.
 *
 * @returns {void}
 * @public
 */
export function disableEventTargetPatching(): void;
//# sourceMappingURL=eventtarget-context.d.mts.map