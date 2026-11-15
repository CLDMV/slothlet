/**
 * Read a stack with slothlet's own formatter.
 * @param {function(Error, Array<object>): unknown} format - Makes the result from the error and its call sites.
 * @param {object} [options] - Options.
 * @param {number} [options.limit] - The most frames to capture; the budget is left alone when not given.
 * @param {Error} [options.error] - An error whose stack is still unread, to read instead of a new one.
 * @param {Function} [options.skip] - Capture from below this function's frame (`Error.captureStackTrace`).
 * @returns {{value: unknown}|{text: string}|null} The formatted result (`value`); on an engine without a formatter hook,
 *   the stack as text (`text`); null when the read cannot be trusted.
 * @internal
 */
export function readStack(format: (arg0: Error, arg1: Array<object>) => unknown, { limit, error, skip }?: {
    limit?: number | undefined;
    error?: Error | undefined;
    skip?: Function | undefined;
}): {
    value: unknown;
} | {
    text: string;
} | null;
/**
 * How many stacks slothlet has read since it loaded.
 * @returns {number} The count.
 * @internal
 * @example
 * const before = stackReadCount();
 * api.leaf();
 * stackReadCount() - before; // the reads the call made
 */
export function stackReadCount(): number;
/**
 * The stack as V8 formats an error with no message, from its call sites, with each site's own `toString` (fixed on its
 * prototype): the `name` and `message` an `Error.prototype` getter might report are not read.
 * @param {Error} _error - The error.
 * @param {Array<object>} sites - The call sites, innermost first.
 * @returns {string} The stack text.
 * @internal
 */
export function stackText(_error: Error, sites: Array<object>): string;
/**
 * The call sites themselves, for a reader that walks them.
 * @param {Error} _error - The error.
 * @param {Array<object>} sites - The call sites, innermost first.
 * @returns {Array<object>} The call sites.
 * @internal
 */
export function stackSites(_error: Error, sites: Array<object>): Array<object>;
//# sourceMappingURL=stack-read.d.mts.map