/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/env-preload.mjs
 *	@Date: 2026-01-29 16:40:03 -08:00 (1769733603)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-29 16:40:35 -08:00 (1769733635)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

process.env.NODE_ENV ??= "development";
process.env.NODE_OPTIONS ??= "--conditions=slothlet-dev";
