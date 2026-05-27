/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/module-sort.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Pure sort function for `DiscoverResult[]`.
 * @module @cldmv/slothlet/helpers/module-sort
 * @internal
 *
 * @description
 * Default comparator sorts by `manifest.priority` descending (higher first)
 * with `packageName` ascending as the tiebreak. Pass any custom comparator
 * matching `Array.prototype.sort`'s `(a, b) => number` signature to override.
 *
 * Pure function: returns a new array; never mutates the input. The
 * `DiscoverResult` entries are already deep-frozen by `discoverModules()`
 * per M3, so the comparator cannot mutate them through this surface either.
 */
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
 * import { sortModules } from "@cldmv/slothlet/helpers/module-sort";
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