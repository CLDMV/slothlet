/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_value_default/scope/addapi.mjs
 *	@Date: 2026-10-11T21:38:05-07:00 (1791779885)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:03:07-07:00 (1791781387)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an addapi file whose default is a Proxy answering a member it does not hold.
 * @module api_smart_flatten_addapi_value_default.scope.addapi
 */

export default new Proxy(
	{ level: 1 },
	{
		get: (target, key) => (key === "dyn" ? "dyn" : Reflect.get(target, key))
	}
);
