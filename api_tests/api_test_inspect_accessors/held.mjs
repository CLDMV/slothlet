/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inspect_accessors/held.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An object member holding accessors, each counting the times it runs on `globalThis.__inspectAccessorRuns`.
 * @module api_test_inspect_accessors/held
 */

/**
 * Count one run of an accessor.
 * @returns {void}
 */
function ran() {
	globalThis.__inspectAccessorRuns = (globalThis.__inspectAccessorRuns ?? 0) + 1;
}

/**
 * Data beside a getter, a setter and a getter/setter pair.
 * @type {object}
 */
export const record = {
	plain: 1,
	get reading() {
		ran();
		return 2;
	},
	set writing(value) {
		ran();
	},
	get both() {
		ran();
		return 3;
	},
	set both(value) {
		ran();
	}
};
