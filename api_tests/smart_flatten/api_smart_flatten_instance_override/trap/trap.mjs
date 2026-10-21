/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_instance_override/trap/trap.mjs
 *	@Date: 2026-10-12T12:32:02-07:00 (1791833522)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T13:04:31-07:00 (1791835471)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a self-named class-instance default with a named export and an own enumerable getter that throws.
 * @module api_smart_flatten_instance_override.trap.trap
 */

class Trap {
	constructor() {
		Object.defineProperty(this, "boom", {
			get() {
				throw new Error("boom read");
			},
			enumerable: true,
			configurable: true
		});
	}
}

export default new Trap();

export const tag = "named";
