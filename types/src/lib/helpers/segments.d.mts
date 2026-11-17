/**
 * The segments of an api path.
 * @param {string|ReadonlyArray<string>|null|undefined} path - A dotted path, an array of segments, or nothing.
 * @returns {string[]|null} A new array of its segments: `[]` for the root (`""`, `"."`), `null` for no path.
 * @example
 * segmentsOf("math.add"); // ["math", "add"]
 * segmentsOf(""); // []
 * segmentsOf(["math", "add"]); // ["math", "add"] (a copy)
 * segmentsOf(null); // null
 * @package
 */
export function segmentsOf(path: string | ReadonlyArray<string> | null | undefined): string[] | null;
//# sourceMappingURL=segments.d.mts.map