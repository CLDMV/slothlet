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
 * Put a member on a value being composed. A layer holds it itself, by definition, so it never reaches the
 * value under the layer (a write to a member that value has would). Anything else takes an assignment.
 * @param {object|Function} target - The value being composed (a layer, or a copy the build owns).
 * @param {PropertyKey} key - Member name.
 * @param {unknown} value - Member value.
 * @returns {void}
 * @package
 *
 * @example
 * holdMember(moduleContent, "extra", mod.extra);
 */
export function holdMember(target: object | Function, key: PropertyKey, value: unknown): void;
/**
 * The keys a composition layer holds itself (the named exports composed onto it), in order. Every other
 * key the layer reports is answered by the value under it.
 * @param {object|Function} layer - A composition layer (see {@link isCompositionLayer}).
 * @returns {PropertyKey[]} The held keys; none for a value that is not a layer.
 * @package
 *
 * @example
 * layerHeldKeys(flatten.composeFunctionDefault(mod.default)); // ["extra"] once `extra` is composed onto it
 */
export function layerHeldKeys(layer: object | Function): PropertyKey[];
/**
 * Whether a value is one of the Proxies composition makes: a layer ({@link layerOver}) or a method read
 * through one, bound to the value it came from. Only the registries are read, so nothing of the value runs.
 * @param {*} value - The value.
 * @returns {boolean} True for a layer or a layer's bound method.
 * @internal
 *
 * @example
 * isCompositionProxy(layerOver({})); // true
 */
export function isCompositionProxy(value: any): boolean;
/**
 * The method a composition layer's bound form of it stands for: a method of the value under a layer is handed out
 * bound to that value, and is the value's own method all the same (#632).
 * @param {*} value - A value a layer handed out.
 * @returns {Function|undefined} The method behind it, or undefined for anything else.
 * @package
 *
 * @example
 * layerMethodOriginal(layer.get) === Map.prototype.get; // true for a layer over a Map
 */
export function layerMethodOriginal(value: any): Function | undefined;
/**
 * Whether a composition layer answers `key` from the value under it, reading or writing it on that value, which is
 * the receiver its getters and setters run on: a key the layer neither holds itself nor hides (#632).
 * @param {object|Function} layer - A composition layer (see {@link isCompositionLayer}).
 * @param {PropertyKey} key - The key.
 * @returns {boolean} True when the value under the layer answers it; false for a value that is not a layer.
 * @package
 *
 * @example
 * layerForwards(flatten.composeFunctionDefault(mod.default), "name"); // true
 */
export function layerForwards(layer: object | Function, key: PropertyKey): boolean;
/**
 * The value under a composition layer: the module's own array or function, which takes an integrity
 * operation (seal, freeze) the layer itself refuses.
 * @param {object|Function} layer - A composition layer, or any other value.
 * @returns {object|Function} The value under a layer; any other value, unchanged.
 * @package
 *
 * @example
 * layerUnderlying(flatten.composeFunctionDefault(mod.default)) === mod.default; // true
 */
export function layerUnderlying(layer: object | Function): object | Function;
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
 *   so a function, an array or a class instance needs a layer as well.
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
 * The same layer laid over another value: what the layer holds and hides, over `underlying` (#597). Used where the
 * value a layer composes over is replaced by a stand-in for it.
 * @param {object} layered - A layer {@link copyForComposition} returned.
 * @param {object|Function} underlying - The value to lay it over.
 * @returns {object|Function} The new layer.
 * @package
 *
 * @example
 * const impl = layerOnto(layer, standIn);
 */
export function layerOnto(layered: object, underlying: object | Function): object | Function;
/**
 * Lay a layer again over the value a layer composes over, starting with `members` in their order; a
 * member the value itself holds keeps coming from the value, unless the layer being relaid held it over
 * the value's own. Members that layer hid stay hidden. Used where a folder's members must appear in
 * eager's order.
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