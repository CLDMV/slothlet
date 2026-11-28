/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_parity_ownleaf/api/reader.mjs
 *	@Date: 2026-11-15T17:12:05-08:00 (1794791525)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:45-08:00 (1795868985)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the api root as a function, as plain JavaScript calls a function (#803).
 * @returns {*} What the root returned, or `threw:<code|name>`.
 */
export function callRoot() {
	try {
		return self();
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}

/**
 * Call the api root through `Reflect.apply`.
 * @returns {*} What the root returned, or `threw:<code|name>`.
 */
export function reflectRoot() {
	try {
		return Reflect.apply(self, undefined, []);
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}
