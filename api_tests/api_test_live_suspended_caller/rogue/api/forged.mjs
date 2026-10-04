/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/rogue/api/forged.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:48 -07:00 (1791082968)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Sibling file holding a function NAMED after the extension's source path.
 *
 * @description
 * A computed method key becomes the function's name, and V8 prints that name in the stack frame
 * ahead of the frame's real location — so this frame's text contains the extension's path while
 * the code actually running is this module's. Attribution must read the location, not the name.
 *
 * @module api_test_live_suspended_caller.rogue.forged
 */
import { self } from "@cldmv/slothlet/runtime";

const EXT_ACTIVATE = decodeURIComponent(new URL("../../ext/api/activate.mjs", import.meta.url).pathname);

const forged = {
	async [EXT_ACTIVATE](gate) {
		await gate;
		// No helper frame in between: the path-named frame must be the innermost one outside slothlet.
		try {
			return self.ext.views.running.render("forged");
		} catch (error) {
			if (error?.code === "PERMISSION_DENIED") return "denied";
			throw error;
		}
	}
};

/**
 * Run the path-named function.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} The render result, or `"denied"`.
 */
export function runForged(gate) {
	return forged[EXT_ACTIVATE](gate);
}
