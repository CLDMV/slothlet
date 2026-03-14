/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/env-preload.mjs
 *	@Date: 2026-01-29T22:04:09-08:00 (1769753049)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:40 -08:00 (1772425300)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

process.env.NODE_ENV ??= "development";
process.env.NODE_OPTIONS ??= "--conditions=slothlet-dev";
