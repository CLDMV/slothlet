/**
 * General utility functions
 * @class Utilities
 * @extends ComponentBase
 * @package
 */
export class Utilities extends ComponentBase {
    static slothletProperty: string;
    /**
     * Check if value is a plain object
     * @param {*} obj - Value to check
     * @returns {boolean} True if plain object
     * @public
     */
    public isPlainObject(obj: any): boolean;
    /**
     * Deep merge two plain objects recursively.
     *
     * Differences from a simple spread:
     * - Recursively merges nested plain objects rather than replacing them.
     * - Uses `hasOwnProperty` to skip prototype-chain keys (no prototype pollution).
     * - Non-plain values (arrays, class instances, primitives) are always copied by
     *   value from `source`, never merged.
     * - When `source[key]` is a plain object but `target[key]` is not (or absent),
     *   the merge starts from `{}` so the returned sub-tree is always a fresh copy.
     * - If either top-level argument is not a plain object, returns `source` as-is.
     *
     * @param {Object} target - Base object (not mutated).
     * @param {Object} source - Source object whose keys are merged in.
     * @returns {Object} New merged object.
     * @public
     */
    public deepMerge(target: any, source: any): any;
    /**
     * Deep clone a value, handling Proxy objects and functions that `structuredClone`
     * cannot serialise.
     *
     * Strategy:
     * 1. Try `structuredClone` — fast and spec-correct for plain data.
     * 2. Fall back to a manual recursive copy for Proxies, callables, and other
     *    non-serialisable objects; errors on individual property clones are swallowed
     *    and the original reference is retained for that key.
     *
     * @param {unknown} obj - Value to clone.
     * @returns {unknown} Deep clone of `obj`.
     * @public
     */
    public deepClone(obj: unknown): unknown;
    /**
     * Generate unique ID
     * @returns {string} Unique identifier
     * @public
     */
    public generateId(): string;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=utilities.d.mts.map