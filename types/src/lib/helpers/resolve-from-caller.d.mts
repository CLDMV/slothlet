/**
 * Path resolver component
 * @class Resolver
 * @extends ComponentBase
 * @package
 */
export class Resolver extends ComponentBase {
    static slothletProperty: string;
    /**
     * Get V8 stack trace as CallSite array.
     * @param {Function} [skipFn] - Optional function to skip from stack trace
     * @returns {Array} Array of CallSite objects
     * @public
     */
    public getStack(skipFn?: Function): any[];
    /**
     * Convert file:// URL to filesystem path or return as-is.
     * @param {any} v - Value to convert
     * @returns {string|null} Filesystem path or null
     * @public
     */
    public toFsPath(v: any): string | null;
    /**
     * Resolve relative path from caller's context.
     * @param {string} rel - Relative path to resolve
     * @returns {string} Absolute filesystem path
     * @public
     */
    public resolvePathFromCaller(rel: string): string;
    #private;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=resolve-from-caller.d.mts.map