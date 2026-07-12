/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/widgets.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Class-export fixture for testing `constructTrap` permission parity.
 * Exposed as `self.widgets.Widget`; constructed by `callers.widgetCaller` so that
 * `new` construction crosses a module boundary and is subject to permission gating.
 * @module api_test_permissions.widgets
 * @memberof module:api_test_permissions
 */

/**
 * A simple widget class used to verify permission enforcement on the `construct` trap.
 * @class Widget
 * @memberof module:api_test_permissions.widgets
 */
export class Widget {
	/**
	 * @param {string} label - Label stored on the instance.
	 */
	constructor(label) {
		this.label = label;
	}

	/**
	 * Returns the widget label.
	 * @returns {string} The stored label.
	 * @example
	 * const w = new Widget("a");
	 * w.describe(); // "widget:a"
	 */
	describe() {
		return `widget:${this.label}`;
	}
}
