/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_node_shape_plain_js/stubborn.mjs
 *	@Date: 2026-11-25T02:36:53-08:00 (1795603013)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:01-08:00 (1795868941)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/** An object behind a Proxy that refuses to be made non-extensible. */
export const stubborn = new Proxy(
	{ b: 2 },
	{
		preventExtensions() {
			return false;
		}
	}
);
