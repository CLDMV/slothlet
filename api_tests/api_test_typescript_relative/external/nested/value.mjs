/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typescript_relative/external/nested/value.mjs
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
 * Plain ESM module nested one directory deeper, imported via a longer
 * relative path from a TypeScript API module.
 * @returns {string} A fixed marker string.
 */
export function nestedTag() {
	return "nested-tag";
}
