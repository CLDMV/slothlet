/**
 * The clock of an instance: its own when it has one, the default otherwise. Anything that is not a real instance (a
 * test's stand-in) has none.
 * @param {{clock?: Clock}|null|undefined} slothlet - The instance.
 * @returns {Clock} Its clock.
 * @internal
 * @example
 * clockOf(slothlet).now();
 */
export function clockOf(slothlet: {
    clock?: Clock;
} | null | undefined): Clock;
/**
 * Build an instance's clock from the host's `clock` option.
 * @param {{now?: Function, set?: Function, clear?: Function}|undefined} option - The option as the host gave it (`set`
 *   schedules a callback as `setTimeout` does, `clear` cancels one as `clearTimeout` does); absent means the default clock.
 * @returns {Clock|null} The clock, or `null` when the option is not an object whose given members are functions.
 * @internal
 * @example
 * const clock = createClock({ now: () => 1000 });
 * clock.now(); // 1000
 */
export function createClock(option: {
    now?: Function;
    set?: Function;
    clear?: Function;
} | undefined): Clock | null;
/**
 * The clock of an instance whose host gave none: the functions slothlet loaded with.
 * @type {Clock}
 * @internal
 * @example
 * DEFAULT_CLOCK.now(); // the same as Date.now() when slothlet loaded
 */
export const DEFAULT_CLOCK: Clock;
/**
 * The clock of an instance.
 */
export type Clock = {
    /**
     * - The current time in milliseconds.
     */
    now: () => number;
    /**
     * - Schedule a callback.
     */
    setTimeout: (arg0: (...args: unknown[]) => void, arg1: number | undefined, ...args: unknown[]) => unknown;
    /**
     * - Cancel a timer `setTimeout` made.
     */
    clearTimeout: (arg0: unknown) => void;
    /**
     * - Whether the host supplied `setTimeout`: slothlet's deferred work then runs on it.
     */
    hostTimers: boolean;
};
//# sourceMappingURL=clock.d.mts.map