/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/module-sort.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T17:23:49-08:00 (1794878629)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Pure sort function for `DiscoverResult[]`.
 * @module @cldmv/slothlet/helpers/module-sort
 * @internal
 *
 * @description
 * Default comparator sorts by `manifest.priority` descending (higher first)
 * with `package` ascending as the tiebreak. Pass any custom comparator
 * matching `Array.prototype.sort`'s `(a, b) => number` signature to override.
 *
 * Pure function: returns a new array; never mutates the input. The
 * `DiscoverResult` entries are already deep-frozen by `discoverModules()`
 * per M3, so the comparator cannot mutate them through this surface either.
 */
import { ArrayMethods, copyList } from "#helpers/intrinsics";

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
export function sortModules(results, comparator) {
	const cmp = typeof comparator === "function" ? comparator : defaultModuleComparator;
	return ArrayMethods.sort(copyList(results), cmp);
}

/**
 * Default comparator: `manifest.priority` descending (higher first), with
 * `package` ascending as a stable, deterministic tiebreak.
 *
 * Uses straight `<`/`>` string comparison (JS codepoint ordering) — not
 * `String.prototype.localeCompare()` — because the latter delegates to the
 * host's ICU/collation defaults and can produce different orders on
 * different hosts (Node bundled-ICU vs system-ICU, different OS default
 * locales). Codepoint comparison is host-independent.
 *
 * @param {DiscoverResult} a
 * @param {DiscoverResult} b
 * @returns {number}
 * @private
 */
function defaultModuleComparator(a, b) {
	const pa = typeof a?.manifest?.priority === "number" ? a.manifest.priority : 0;
	const pb = typeof b?.manifest?.priority === "number" ? b.manifest.priority : 0;
	if (pa !== pb) return pb - pa;
	const na = a?.package ?? "";
	const nb = b?.package ?? "";
	if (na < nb) return -1;
	if (na > nb) return 1;
	return 0;
}
