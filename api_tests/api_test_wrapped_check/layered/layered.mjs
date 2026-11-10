/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapped_check/layered/layered.mjs
 *	@Date: 2026-11-08T16:50:22-08:00 (1794185422)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:56:30-08:00 (1794185790)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose default is a frozen class instance with a named export beside it, so slothlet
 * composes the two through a layer over the instance instead of writing to it, and an inherited method read
 * through the node is the layer's bound form of it.
 */

/** A class whose method the frozen default inherits. */
class Greeter {
	/** @returns {number} A value. */
	greet() {
		return 1;
	}
}

/** The module's default, which slothlet must not change. */
const greeter = Object.freeze(new Greeter());

export default greeter;

/** A named export composed beside the default. */
export const extra = 2;
