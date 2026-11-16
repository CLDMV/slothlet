/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_own_leaf/withleaf/root.mjs
 *	@Date: 2026-11-15T13:59:40-08:00 (1794779980)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T17:04:07-08:00 (1794791047)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The api root's file: its default export is the root function, which reads `self.vault.get()` as its
 * own code and reports what it was answered.
 * @module api_test_root_own_leaf.root
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The root function: reads the vault through `self`.
 * @returns {string} The vault's answer, or `"threw:<code>"`.
 * @example
 * api(); // "SECRET"
 */
export default function root() {
	try {
		return self.vault.get();
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}

/**
 * A leaf of the root's file beside the root function.
 * @returns {string} `"other"`.
 * @example
 * api.other(); // "other"
 */
export function other() {
	return "other";
}
