/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_root_own_leaf/withleaf/reader.mjs
 *	@Date: 2026-11-15T13:59:40-08:00 (1794779980)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:33-08:00 (1795868973)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that calls the api root's function through `self.call`.
 * @module api_test_root_own_leaf.reader
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the api root's function.
 * @returns {string} What the root answered, or `"threw:<code>"` when the call was refused.
 * @example
 * api.reader.callRoot(); // "SECRET"
 */
export function callRoot() {
	try {
		return self.call(null);
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}

/**
 * Read the vault directly.
 * @returns {string} The vault's answer, or `"threw:<code>"`.
 * @example
 * api.reader.direct(); // "SECRET"
 */
export function direct() {
	try {
		return self.vault.get();
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}
