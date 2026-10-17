/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_instance_default/tools/tally.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T23:16:44-07:00 (1791613004)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a plain-object default whose getters read the object's own members through
 * `this`, as in plain JavaScript, plus a getter that throws, which only a read may run.
 * @module smart_flatten.api_smart_flatten_instance_default.tools.tally
 */

export default {
	title: "tally",
	count: 2,
	/** @returns {number} The new count. */
	bump() {
		this.count += 1;
		return this.count;
	},
	/** @returns {string} The title and count, read through `this`. */
	get summary() {
		return `${this.title}:${this.count}`;
	},
	/** @returns {never} Throws on every read. */
	get broken() {
		throw new Error("tally.broken read");
	}
};
