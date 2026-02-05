/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/env-preload.mjs
 *	@Date: 2026-01-29T22:04:09-08:00 (1769753049)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:44 -08:00 (1770266384)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

process.env.NODE_ENV ??= "development";
process.env.NODE_OPTIONS ??= "--conditions=slothlet-dev";
