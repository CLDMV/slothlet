/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_self_value_siblings/ledger/ledger.mjs
 *	@Date: 2026-10-11T21:00:00-07:00 (1791784800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T21:00:00-07:00 (1791784800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a self-named file whose default is a frozen object, beside a sibling.
 * @module api_smart_flatten_self_value_siblings.ledger.ledger
 */

export default Object.freeze({
	total: 3,
	/** @returns {string} Marker reading the object's own member. */
	describe() {
		return `ledger:${this.total}`;
	}
});
