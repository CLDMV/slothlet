/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_instance_override/inst/inst.mjs
 *	@Date: 2026-10-12T10:09:39-07:00 (1791824979)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T10:36:20-07:00 (1791826580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a self-named class-instance default whose own member a named export collides with.
 * @module api_smart_flatten_instance_override.inst.inst
 */

class Thing {
	constructor() {
		this.mode = "own";
	}
}

export default new Thing();

export const mode = "named";
