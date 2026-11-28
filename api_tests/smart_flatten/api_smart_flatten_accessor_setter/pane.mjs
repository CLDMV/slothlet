/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/smart_flatten/api_smart_flatten_accessor_setter/pane.mjs
 *	@Date: 2026-10-12T06:34:19-07:00 (1791812059)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:17-08:00 (1795869017)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a file whose object default has a getter and setter pair, beside a same-named folder.
 * @module api_smart_flatten_accessor_setter.pane
 */

export default {
	_w: 1,
	get w() {
		return this._w;
	},
	set w(x) {
		this._w = x * 3;
	}
};
