/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typegen_mixed/widgets/widgets.mjs
 *	@Date: 2026-09-28 00:01:45 -07:00 (1790578905)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:23 -07:00 (1791083003)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Self-named file inside its own folder — flattens into the folder namespace
 * (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.widgets
 */

/**
 * Create a widget.
 * @param {string} name - Widget name.
 * @returns {{ id: number, name: string }} The widget.
 */
export function create(name) {
	return { id: name.length, name };
}

/**
 * Count widgets.
 * @returns {number} Always zero in this fixture.
 */
export function count() {
	return 0;
}
