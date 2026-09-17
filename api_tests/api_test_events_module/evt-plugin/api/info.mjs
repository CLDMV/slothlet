/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api/info.mjs
 *	@Date: 2026-09-17 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-17 00:00:00 -07:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Trivial leaf so the module has an api surface to mount. The point of this fixture is its
 * manifest-declared EVENT rule (#407), not its api — so the leaf imports nothing (a fixture with
 * its own package.json cannot self-reference `@cldmv/slothlet` in-repo).
 * @returns {string} The module name.
 */
export const name = () => "@local/evt-plugin";
