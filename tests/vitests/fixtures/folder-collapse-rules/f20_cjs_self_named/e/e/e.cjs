/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/folder-collapse-rules/f20_cjs_self_named/e/e/e.cjs
 *	@Date: 2026-11-13T00:23:16-08:00 (1794558196)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T00:30:08-08:00 (1794558608)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `e/e/e.cjs` of fixture `f20_cjs_self_named`: a same-named folder combined with a flattening rule (#743). Each function returns `"<file>:<export>"` so a test can tell which file and export a node is.
 * @module folder-collapse-rules.f20_cjs_self_named
 */

module.exports = {
	a() {
		return "e/e/e.cjs:a";
	},
	b() {
		return "e/e/e.cjs:b";
	}
};
