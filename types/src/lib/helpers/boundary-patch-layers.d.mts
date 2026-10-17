/**
 * Start a layer over what is installed now.
 *
 * @param {*} installed - The value or descriptor installed now, which the new wrapper will wrap.
 * @param {function(*): *} [identify] - Maps an installed value or descriptor to the function a layer
 *   is registered under; the value itself by default (a patched method or constructor). For an
 *   accessor descriptor, its getter.
 * @returns {{active: boolean, below: *}} The layer. `below` is what the wrapper should delegate to —
 *   `installed` with any inactive layers looked through.
 * @internal
 */
export function openLayer(installed: any, identify?: (arg0: any) => any): {
    active: boolean;
    below: any;
};
/**
 * Register a layer under the function that identifies it once installed.
 * @param {Function} marker - The wrapper, or the getter of a wrapping accessor.
 * @param {{active: boolean, below: *}} layer - From {@link openLayer}.
 * @returns {void}
 * @internal
 */
export function markLayer(marker: Function, layer: {
    active: boolean;
    below: any;
}): void;
/**
 * Whether a function is a layer that is still active.
 * @param {*} marker - A function that may identify a layer.
 * @returns {boolean} True for an active layer.
 * @internal
 */
export function isActiveLayer(marker: any): boolean;
/**
 * Retire a layer: from now on its wrapper passes through. Returns what to put back if the caller's
 * wrapper is still the one installed.
 *
 * @param {{active: boolean, below: *}} layer - From {@link openLayer}.
 * @param {function(*): *} [identify] - As for {@link openLayer}.
 * @returns {*} What the layer wrapped, with any inactive layers under it looked through.
 * @internal
 */
export function closeLayer(layer: {
    active: boolean;
    below: any;
}, identify?: (arg0: any) => any): any;
/**
 * Whether `host[key]` is still `value`, read from its own descriptor: a getter another library
 * installed over the patch since is never run, so a teardown cannot be made to throw by it, and a
 * replacement it does not recognise keeps its place.
 * @param {object} host - Object the patch was installed on.
 * @param {PropertyKey} key - The patched key.
 * @param {*} value - The wrapper this copy installed.
 * @returns {boolean} True when `key` is an own data property holding `value`.
 * @internal
 */
export function holdsValue(host: object, key: PropertyKey, value: any): boolean;
//# sourceMappingURL=boundary-patch-layers.d.mts.map