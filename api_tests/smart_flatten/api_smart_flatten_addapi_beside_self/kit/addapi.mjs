/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_beside_self/kit/addapi.mjs
 *	@Date: 2026-10-12T10:57:33-07:00 (1791827853)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T11:33:23-07:00 (1791830003)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a class-instance addapi default with a private-field getter and setter, a setter alone, a field and a method.
 * @module api_smart_flatten_addapi_beside_self.kit.addapi
 */

class Kit {
	#v = 1;
	n = 1;

	get v() {
		return this.#v;
	}

	set v(x) {
		this.#v = x * 2;
	}

	set only(x) {
		this.got = x;
	}

	bump() {
		return ++this.n;
	}
}

export default new Kit();
