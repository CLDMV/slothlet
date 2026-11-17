/**
 * @fileoverview The form slothlet reports an api path in: its segments, as an array.
 * @module @cldmv/slothlet/helpers/segments
 * @internal
 *
 * @description
 * Every api path slothlet reports (event payloads, error details, audit entries, …) is a segments array: the stored
 * form, lossless where a segment could hold a ".", and one line for a consumer to join. Paths slothlet takes keep
 * accepting a dotted string or an array; messages render the joined form.
 */
import { Arrays, copyList, splitText } from "#helpers/intrinsics";

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
export function segmentsOf(path) {
	if (path === null || path === undefined) return null;
	if (Arrays.isArray(path)) return copyList(path);
	if (path === "" || path === ".") return [];
	return splitText(path, ".");
}
