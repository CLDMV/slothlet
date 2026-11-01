/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_construct/widget/widget.mjs
 *	@Date: 2026-11-01T10:27:19-08:00 (1793557639)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T10:56:17-08:00 (1793559377)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * A class that is the folder's own value, so the lazy node itself is the class.
 */
export default class Widget {
	/**
	 * @param {*} size - Kept on the instance.
	 */
	constructor(size) {
		this.size = size;
	}
}
