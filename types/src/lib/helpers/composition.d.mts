/**
 * Whether a value is a layer {@link copyForComposition} or {@link relayer} returned.
 * @param {unknown} value - The value.
 * @returns {boolean} True for a composition layer.
 * @package
 *
 * @example
 * isCompositionLayer(copyForComposition(new Map(), { addsMembers: true })); // true
 */
export function isCompositionLayer(value: unknown): boolean;
/**
 * Register how to recognize an api node (see {@link isApiNode}).
 * @param {function(unknown): boolean} check - Returns true for a slothlet wrapper proxy.
 * @returns {void}
 * @package
 *
 * @example
 * setApiNodeCheck((value) => proxyRegistry.has(value));
 */
export function setApiNodeCheck(check: (arg0: unknown) => boolean): void;
/**
 * The version of a module's value the build may change, without the change reaching the module's
 * export (see the module description for the rule).
 * @param {unknown} value - The module's value.
 * @param {object} [options={}] - Options.
 * @param {boolean} [options.addsMembers=false] - True when named exports will be added to the result,
 *   so an array or a class instance needs a layer as well.
 * @returns {unknown} A copy, a layer, or `value` itself.
 * @package
 *
 * @example
 * const moduleContent = copyForComposition(mod.default, { addsMembers: true });
 * moduleContent.extra = mod.extra; // mod.default is unchanged
 */
export function copyForComposition(value: unknown, { addsMembers }?: {
    addsMembers?: boolean | undefined;
}): unknown;
/**
 * Lay a layer again over the value a layer composes over, starting with `members` in their order; a
 * member the value itself holds keeps coming from the value. Used where a folder's members must appear
 * in eager's order.
 * @param {object} layered - A layer {@link copyForComposition} returned, or a value to layer.
 * @param {Array<[PropertyKey, PropertyDescriptor]>} members - Members to start with, in order.
 * @returns {object} The new layer.
 * @package
 *
 * @example
 * const instance = relayer(impl, [["sib", { value: sib }], ["extra", { value: extra }]]);
 */
export function relayer(layered: object, members: Array<[PropertyKey, PropertyDescriptor]>): object;
//# sourceMappingURL=composition.d.mts.map