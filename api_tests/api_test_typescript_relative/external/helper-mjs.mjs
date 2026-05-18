/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typescript_relative/external/helper-mjs.mjs
 *	@Date: 2026-05-17T22:01:23-07:00 (1779080483)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 06:39:24 -07:00 (1779111564)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Plain ESM (`.mjs`) module living OUTSIDE the slothlet API directory, imported
 * with a relative specifier from a TypeScript API module.
 * @returns {string} A fixed marker string.
 */
export function pingMjs() {
	return "mjs-pong";
}
