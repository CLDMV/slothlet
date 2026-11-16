/**
 * Read a stack with slothlet's own formatter.
 * @param {function(Error, Array<object>): unknown} format - Makes the result from the error and its call sites.
 * @param {object} [options] - Options.
 * @param {number} [options.limit] - The most frames to capture; when not given, the budget of the realm read from is
 *   left alone (the engine's default of 10 in slothlet's own realm).
 * @param {Error} [options.error] - An error whose stack is still unread, to read instead of a new one. One made by
 *   {@link unreadError} is read from slothlet's own realm; any other is formatted through the global `Error` of the
 *   realm that made it.
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
 * The frame budget of the read in progress: what a formatter compares its call sites' count with to tell whether the
 * capture was cut short.
 * @returns {number|undefined} The budget, or undefined outside a read.
 * @internal
 * @example
 * readStack((_error, sites) => sites.length >= stackBudget(), { limit: 48 }); // { value: true } when cut short
 */
export function stackBudget(): number | undefined;
/**
 * An error whose stack is not read yet, captured now with a frame budget, to read later with {@link readStack} (`error`).
 * Made by slothlet's own realm where there is one, so neither the capture nor the later read depends on the global
 * `Error` and its settings.
 * @param {number} limit - The most frames to capture.
 * @returns {Error|null} The error, or null when the budget cannot be held for the capture.
 * @internal
 */
export function unreadError(limit: number): Error | null;
/**
 * Whether an error's `stack` is still the engine's own getter, unread: of the global realm's errors or of slothlet's
 * own realm's (see {@link unreadError}).
 * @param {unknown} error - The error.
 * @returns {boolean} True when it is.
 * @internal
 */
export function hasEngineStack(error: unknown): boolean;
/**
 * Whether a function is the `stack` getter or setter the engine gives the errors of this realm, as it was when
 * slothlet loaded: the getter runs no code of a module's but the realm's `Error.prepareStackTrace`, which
 * {@link runUnformatted} holds, and the setter stores a value.
 * @param {unknown} half - A getter or setter.
 * @returns {boolean} True when it is.
 * @internal
 */
export function isEngineStackAccessor(half: unknown): boolean;
/**
 * Run `run` with the global `Error` and its `prepareStackTrace` held so that reading the stack of an error of this realm
 * not read yet formats nothing and runs none of a module's code: the read throws instead, and the stack is left as it
 * was.
 * @param {Function} run - What to run.
 * @returns {{held: false}|{held: true, value: unknown}|{held: true, error: unknown, unformatted: boolean}} Whether the
 *   formatter could be held, and what `run` returned or threw; `unformatted` when it threw because a stack was read.
 * @internal
 */
export function runUnformatted(run: Function): {
    held: false;
} | {
    held: true;
    value: unknown;
} | {
    held: true;
    error: unknown;
    unformatted: boolean;
};
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