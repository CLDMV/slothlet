/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_value_default/lens/addapi.mjs
 *	@Date: 2026-10-11T22:30:00-07:00 (1791789000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:30:00-07:00 (1791789000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an addapi file alone in its folder (mounted with api.add), default Proxy answering a member it does not hold, with a named export.
 * @module api_smart_flatten_addapi_value_default.lens.addapi
 */

export default new Proxy(
	{ level: 1 },
	{
		get: (target, key) => (key === "dyn" ? "dyn" : Reflect.get(target, key))
	}
);

/**
 * @returns {string} Marker naming this named export.
 */
export const extra = () => "lens.extra";
