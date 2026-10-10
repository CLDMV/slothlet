/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_default_member_conflict_root/root.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T00:00:00-07:00 (1791529200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */
/**
 * @fileoverview Fixture: an api-root function default whose own members `tag` and `fixed` (read-only)
 * are also named exports, so the conflict resolves by collision mode as everywhere else (#421, #587).
 * @module smart_flatten.api_smart_flatten_default_member_conflict_root.root
 */

/** @returns {string} The default's own answer. */
function root() {
	return "root";
}
root.tag = () => "default.tag";
Object.defineProperty(root, "fixed", { value: () => "default.fixed", writable: false, enumerable: true, configurable: true });

export default root;
/** @returns {string} The named export's answer. */
export const tag = () => "named.tag";
/** @returns {string} The named export's answer. */
export const fixed = () => "named.fixed";
/** @returns {string} A named export with no conflict. */
export const extra = () => "named.extra";
