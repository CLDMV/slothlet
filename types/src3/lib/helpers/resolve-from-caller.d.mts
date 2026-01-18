/**
 * Get V8 stack trace as CallSite array.
 * @param {Function} [skipFn] - Optional function to skip from stack trace
 * @returns {Array} Array of CallSite objects
 * @public
 */
export function getStack(skipFn?: Function): any[];
/**
 * Resolve relative path from caller's context.
 * @param {string} rel - Relative path to resolve
 * @returns {string} Absolute filesystem path
 * @public
 */
export function resolvePathFromCaller(rel: string): string;
/**
 * Resolve relative path from caller's context to file:// URL.
 * @param {string} rel - Relative path to resolve
 * @returns {string} Absolute file:// URL
 * @public
 */
export function resolveUrlFromCaller(rel: string): string;
export function toFsPath(v: any): string | null;
//# sourceMappingURL=resolve-from-caller.d.mts.map