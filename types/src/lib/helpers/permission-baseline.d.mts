/**
 * Run the baseline checks for where the instance runs.
 * @param {"node"|"browser"} envTarget - Where the instance runs.
 * @param {BaselineProbes} [probes] - Stand-ins for the probes, for a test.
 * @param {"async"|"live"} [runtime="async"] - The instance's runtime; `async-context-frame` is checked for `"async"` only.
 * @returns {Promise<{met: boolean, checks: Array<{id: string, met: boolean, reason: string|null}>}>} Whether every check
 *   is met, and each check.
 * @internal
 * @example
 * const { met, checks } = await runBaseline("node");
 */
export function runBaseline(envTarget: "node" | "browser", probes?: BaselineProbes, runtime?: "async" | "live"): Promise<{
    met: boolean;
    checks: Array<{
        id: string;
        met: boolean;
        reason: string | null;
    }>;
}>;
/**
 * What the checks ask of the host.
 */
export type BaselineProbes = {
    /**
     * - Whether making code from a string is refused.
     */
    codeFromStringsRefused: () => boolean;
    /**
     * - Whether a script from a `blob:` or `data:` URL is refused.
     */
    importRefused: (arg0: string) => Promise<boolean>;
    /**
     * - vitest's worker global, or null outside vitest.
     */
    vitestWorker: object | null;
    /**
     * - How many vite plugin records slothlet accepted, or null.
     */
    viteRecords: () => (number | null);
    /**
     * - Whether Node's `AsyncContextFrame` is on; null (or
     * absent) where there is no `node:async_hooks` to test, and then the check does not apply.
     */
    asyncContextFrameOn?: (() => boolean) | null | undefined;
};
//# sourceMappingURL=permission-baseline.d.mts.map