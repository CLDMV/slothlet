/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_self_value_siblings/probe/probe.mjs
 *	@Date: 2026-10-11T21:38:05-07:00 (1791779885)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:03:19-07:00 (1791781399)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a self-named file alone in its folder whose default is a callable Proxy answering a member it does not hold.
 * @module api_smart_flatten_self_value_siblings.probe.probe
 */

export default new Proxy(
	/**
	 * @param {string} x - Value to tag.
	 * @returns {string} The tagged value.
	 */
	function probe(x) {
		return "probe:" + x;
	},
	{
		get: (target, key) => (key === "dyn" ? "dyn" : Reflect.get(target, key))
	}
);
