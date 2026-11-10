/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /lib/h.mjs
 *	@Date: 2026-11-08T16:46:18-08:00 (1794185178)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:56:52-08:00 (1794185812)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper of the module's own package (#715): leaf `a` imports it by a relative path, leaf `b` by the
 * package's `#h` import, leaf `c` by the package's own name. Each evaluation records the URL it ran under and the
 * identity object it created, so the fixture can tell one module record from two.
 * @module api_test_own_package_imports.pkg.lib.h
 */

const evaluations = (globalThis.__ownPackageImports ??= { urls: [], identities: [] });

/** This evaluation's identity: the same object through every import of one module record. */
export const identity = {};

evaluations.urls.push(import.meta.url);
evaluations.identities.push(identity);
