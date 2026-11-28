/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api/info.mjs
 *	@Date: 2026-11-16T20:00:00-08:00 (1794888000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:39-08:00 (1795868979)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Trivial leaf so the module has an api surface to mount. The point of this fixture is its manifest-declared
 * permission rule, not its api.
 * @returns {string} The module name.
 */
export const name = () => "@local/unknown-target";
