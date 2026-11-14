/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_default_data/single/ditem.mjs
 *	@Date: 2026-11-13T06:28:39-08:00 (1794580119)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T07:20:55-08:00 (1794583255)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An instance of a class of the module's own holding an object, the file's default export.
 * @module api_test_api_node_default_data/single/ditem
 */

/** A class of the module's own. */
class Item {
	constructor() {
		this.one = { n: 1 };
	}
}

/** An instance of it, the file's default export. */
export default new Item();
