/**
 * Set how the value behind one of slothlet's views is told.
 * @param {function(*): *} behind - Answers the value a view stands over, or
 *   `undefined` for a value that is no view of slothlet's.
 * @returns {void}
 * @internal
 * @example
 * setCloneViewReader((value) => (isView(value) ? valueBehind(value) : undefined));
 */
export function setCloneViewReader(behind: (arg0: any) => any): void;
/**
 * Set how the data of one of slothlet's api nodes is told.
 * @param {function(*): ({value: *}|{list: boolean}|undefined)} shape - Answers `undefined` for a value that is no
 *   loaded api node (or a view of one); `{ list }` for a node whose data is read member by member through the node
 *   itself, as an array (`list: true`) or an object; `{ value }` for a node standing for a value the platform clones
 *   or refuses as it is (a function, a primitive, a `Date`).
 * @returns {void}
 * @internal
 * @example
 * setCloneNodeReader((value) => (isLoadedNode(value) ? { list: Array.isArray(valueOf(value)) } : undefined));
 */
export function setCloneNodeReader(shape: (arg0: any) => ({
    value: any;
} | {
    list: boolean;
} | undefined)): void;
/**
 * Wrap the platform's cloning functions so they take slothlet's views of another module's data. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * enableClonePatching();
 */
export function enableClonePatching(): void;
/**
 * Remove this copy's wrappers, putting back what each wrapped where it is still the one installed. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * disableClonePatching();
 */
export function disableClonePatching(): void;
/**
 * Whether a function is a clone wrapper of any copy of slothlet's.
 * @param {*} fn - A function.
 * @returns {boolean} True for one.
 * @internal
 * @example
 * isClonePatched(globalThis.structuredClone); // true while an instance with the patch is up
 */
export function isClonePatched(fn: any): boolean;
//# sourceMappingURL=clone-context.d.mts.map