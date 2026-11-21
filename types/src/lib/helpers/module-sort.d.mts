/**
 * @typedef {object} DiscoverResult
 * @property {string} package
 * @property {string} folder
 * @property {string[]} mount
 * @property {string} base
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
 * // Default: priority desc, then package asc.
 *
 * @example
 * // Custom: alphabetical only.
 * const alpha = sortModules(found, (a, b) => a.package.localeCompare(b.package));
 *
 * @example
 * // Topological over manifest.dependencies (caller's responsibility to
 * // implement; slothlet ships the plumbing, not the topo sort itself).
 * const topo = sortModules(found, makeDependencyComparator(found));
 */
export function sortModules(results: DiscoverResult[], comparator?: (a: DiscoverResult, b: DiscoverResult) => number): DiscoverResult[];
export type DiscoverResult = {
    package: string;
    folder: string;
    mount: string[];
    base: string;
    manifest: object;
};
//# sourceMappingURL=module-sort.d.mts.map