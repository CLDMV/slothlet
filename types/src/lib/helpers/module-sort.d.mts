/**
 * @typedef {object} DiscoverResult
 * @property {string} packageName
 * @property {string} packageRoot
 * @property {string[]} mountPath
 * @property {string} apiDir
 * @property {object} manifest
 */
/**
 * Sort a `DiscoverResult[]` and return a new array. Pure function.
 *
 * @param {DiscoverResult[]} results - Discovery results to sort.
 * @param {(a: DiscoverResult, b: DiscoverResult) => number} [comparator] - Custom comparator. Defaults to priority desc + alphabetical tiebreak.
 * @returns {DiscoverResult[]} New array sorted by the chosen comparator. Input is not mutated.
 *
 * @example
 * import { sortModules } from "#helpers/module-sort";
 *
 * const sorted = sortModules(found);
 * // Default: priority desc, then packageName asc.
 *
 * @example
 * // Custom: alphabetical only.
 * const alpha = sortModules(found, (a, b) => a.packageName.localeCompare(b.packageName));
 *
 * @example
 * // Topological over manifest.dependencies (caller's responsibility to
 * // implement; slothlet ships the plumbing, not the topo sort itself).
 * const topo = sortModules(found, makeDependencyComparator(found));
 */
export function sortModules(results: DiscoverResult[], comparator?: (a: DiscoverResult, b: DiscoverResult) => number): DiscoverResult[];
export type DiscoverResult = {
    packageName: string;
    packageRoot: string;
    mountPath: string[];
    apiDir: string;
    manifest: object;
};
//# sourceMappingURL=module-sort.d.mts.map