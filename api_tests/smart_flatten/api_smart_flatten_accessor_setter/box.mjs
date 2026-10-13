/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_accessor_setter/box.mjs
 *	@Date: 2026-10-12T06:34:19-07:00 (1791812059)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T07:13:48-07:00 (1791814428)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an object default with a getter and setter pair and a setter alone.
 * @module api_smart_flatten_accessor_setter.box
 */

export default {
	_v: 1,
	get v() {
		return this._v;
	},
	set v(x) {
		this._v = x * 2;
	},
	set only(x) {
		this.got = x;
	}
};
