/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_parity/fnroot/probe.mjs
 *	@Date: 2026-11-15T17:03:37-08:00 (1794791017)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T02:14:11-08:00 (1794824051)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { shape } from "../shape.mjs";

/**
 * Report every operation on `self`, as the host's `shape(api)` reports them on `api`.
 * @param {function(*): string} [inspect] - `util.inspect`, where there is one.
 * @returns {Record<string, *>} What each operation gave.
 */
export function report(inspect) {
	return shape(self, { inspect });
}

/**
 * Hand out `self` itself, held in an object: awaiting `self` would read its `then` outside any call.
 * @returns {{self: Function}} This module's `self`.
 */
export function expose() {
	return { self };
}

/**
 * Whether `self` is extensible, sealed and frozen, as this module sees it.
 * @returns {Array<boolean>|string} The three answers, or the code of what threw.
 */
export function closed() {
	try {
		return [Object.isExtensible(self), Object.isSealed(self), Object.isFrozen(self)];
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}
