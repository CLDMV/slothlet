/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/folder-collapse-rules/f14_object_named_as_folder/e/e/x.mjs
 *	@Date: 2026-11-13T00:23:16-08:00 (1794558196)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T00:30:07-08:00 (1794558607)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `e/e/x.mjs` of fixture `f14_object_named_as_folder`: a same-named folder combined with a flattening rule (#743). Each function returns `"<file>:<export>"` so a test can tell which file and export a node is.
 * @module folder-collapse-rules.f14_object_named_as_folder
 */

export const e = {
	a() {
		return "e/e/x.mjs:e.a";
	},
	b() {
		return "e/e/x.mjs:e.b";
	}
};
