/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/helpers/segments.mjs
 *	@Date: 2026-11-16T19:05:39-08:00 (1794884739)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:45-08:00 (1795869045)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

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
import { Arrays, copyList, setFrom, splitText } from "#helpers/intrinsics";

/**
 * The segments no api path can hold: they name members every object already has. A mount path, a loose `self.x = …`
 * write and a hook pattern all refuse them.
 * @type {Set<string>}
 * @package
 */
export const UNSAFE_PATH_SEGMENTS = setFrom(["__proto__", "constructor", "prototype"]);

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
