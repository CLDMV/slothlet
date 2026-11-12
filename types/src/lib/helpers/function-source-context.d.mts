/**
 * Set how the function behind one of slothlet's stand-ins is told.
 * @param {function(*): (Function|undefined)} behind - Answers the function a value stands for, or `undefined` for a
 *   value that is no stand-in of slothlet's for a function.
 * @returns {void}
 * @internal
 * @example
 * setFunctionSourceReader((value) => (isNode(value) ? functionBehind(value) : undefined));
 */
export function setFunctionSourceReader(behind: (arg0: any) => (Function | undefined)): void;
/**
 * Wrap `Function.prototype.toString` so it answers the source of the function an api node stands for. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * enableFunctionSourcePatching();
 */
export function enableFunctionSourcePatching(): void;
/**
 * Remove this copy's wrapper, putting back what it wrapped where it is still the one installed. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * disableFunctionSourcePatching();
 */
export function disableFunctionSourcePatching(): void;
/**
 * Whether a function is a `toString` wrapper this copy of slothlet installed: told by identity, so a function that
 * only carries the patch's marker is not one. It runs none of a module's code, and the handlers treat it as the
 * engine's own `toString`, which it stands in for.
 * @param {*} fn - A function.
 * @returns {boolean} True for this copy's wrapper.
 * @internal
 * @example
 * isFunctionSourcePatch(Function.prototype.toString); // true while an instance is up
 */
export function isFunctionSourcePatch(fn: any): boolean;
/**
 * Whether a function is a `toString` wrapper of any copy of slothlet's, by its marker. For diagnostics and tests only:
 * the marker is a registered symbol any code can put on a function, so nothing is decided from it.
 * @param {*} fn - A function.
 * @returns {boolean} True for one carrying the marker.
 * @internal
 * @example
 * isFunctionSourcePatched(Function.prototype.toString); // true while an instance with the patch is up
 */
export function isFunctionSourcePatched(fn: any): boolean;
//# sourceMappingURL=function-source-context.d.mts.map