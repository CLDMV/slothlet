/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /lib/c.cjs
 *	@Date: 2026-11-09T00:26:30-08:00 (1794212790)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T00:36:29-08:00 (1794213389)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS helper of the module's own package (#715): the `.cjs` leaf requires it by a relative path,
 * by the package's `#c` import and by the package's own name, and the ES module leaf imports it by `#c`. Each evaluation
 * records the file it ran from and the identity object it created.
 * @module api_test_own_package_requires.pkg.lib.c
 */

const evaluations = (globalThis.__ownPackageRequires ??= { h: [], c: [] });

/** This evaluation's identity: the same object through every spelling that reaches one copy. */
const identity = {};

evaluations.c.push({ url: __filename, identity });

module.exports = { identity };
