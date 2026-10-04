/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permission_principals/base/project/files.mjs
 *	@Date: 2026-09-26T22:18:59-07:00 (1790486339)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:40-07:00 (1791090880)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Project files — the resource-scoped target the principal tests gate (#459).
 * @param {string} projectId - Project whose files are listed.
 * @returns {{ projectId: string, files: string[] }} The listing.
 */
export const list = (projectId) => ({ projectId, files: ["readme.md"] });
