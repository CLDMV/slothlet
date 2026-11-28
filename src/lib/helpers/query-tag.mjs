/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/query-tag.mjs
 *	@Date: 2026-11-28T00:00:00-08:00 (1795852800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T00:00:00-08:00 (1795852800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The mount tag an instance's leaf URLs carry (`module=`, copied onto helper copies as
 * `slothlet_mount=`), written and read back.
 *
 * @description
 * Each `api.slothlet.api.add()` mount imports its own copy of a leaf under `&module=<moduleID>`. Tools that read a
 * script's URL often decode the whole URL once before they treat it as a path: `@vitest/coverage-v8` does, and vite
 * then takes the last `/` of the id as the file's name. A moduleID such as `@scope/pkg` written with one level of
 * escaping comes out of that decode with its `/` back, and the coverage lands on a file named `pkg` (#1042).
 *
 * So a tag holds its value escaped once: in the URL it is escaped twice, and one decode of the URL leaves `%2F`, never
 * a `/`. Whoever reads the parameter (a URLSearchParams lookup, or a stack line decoded once) has the tag;
 * {@link fromQueryTag} turns it back into the value.
 *
 * @module @cldmv/slothlet/helpers/query-tag
 * @internal
 * @private
 */

import { decodeURIComponent, encodeURIComponent, NumberMethods, regExpReplace, String, StringMethods } from "#helpers/intrinsics";

/**
 * One level of escaping: encodeURIComponent, plus the `!'()*` it leaves as they are (a stack frame's location is read
 * up to `&`, `#`, `:`, `)` or whitespace, #601 review).
 * @param {string} value - The text.
 * @returns {string} The text escaped.
 * @private
 */
function escapeOnce(value) {
	return regExpReplace(
		/[!'()*]/g,
		encodeURIComponent(value),
		(char) => `%${StringMethods.toUpperCase(NumberMethods.toString(StringMethods.charCodeAt(char, 0), 16))}`
	);
}

/**
 * The tag for a value (a moduleID): the parameter's value as a URLSearchParams lookup returns it.
 * Set it with URLSearchParams, which escapes it once more, or write {@link queryTagInURL} into a URL by hand.
 * @param {string} value - The value.
 * @returns {string} The tag.
 * @example
 * queryTag("@scope/pkg"); // "%40scope%2Fpkg"
 */
export function queryTag(value) {
	return escapeOnce(String(value));
}

/**
 * The tag as it is written into a URL's query by hand: escaped twice, so a decode of the whole URL leaves no `/`.
 * @param {string} value - The value.
 * @returns {string} The query value.
 * @example
 * queryTagInURL("@scope/pkg"); // "%2540scope%252Fpkg"
 */
export function queryTagInURL(value) {
	return escapeOnce(queryTag(value));
}

/**
 * The value a tag names. A tag that is not well formed names its value only as spelled.
 * @param {string|null|undefined} tag - The tag (the parameter's value, decoded once).
 * @returns {string|null} The value, or null for no tag.
 * @example
 * fromQueryTag("%40scope%2Fpkg"); // "@scope/pkg"
 */
export function fromQueryTag(tag) {
	if (tag === null || tag === undefined) return null;
	try {
		return decodeURIComponent(tag);
	} catch {
		return tag;
	}
}
