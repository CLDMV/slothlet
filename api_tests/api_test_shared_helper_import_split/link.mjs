/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/link.mjs
 *	@Date: 2026-11-08T15:50:17-08:00 (1794181817)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:00:38-08:00 (1794182438)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Link `shared-lib` into the fixture's `node_modules` (#715), as a pnpm workspace links a package: a
 * symlink to a directory outside every `node_modules`, so Node and vite resolve the package name to the real path.
 * @module api_test_shared_helper_import_split.link
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create `node_modules/shared-lib` → `shared-lib/` once (git keeps no symlink in the fixture; the link is ignored).
 * @returns {void}
 */
export function linkSharedLib() {
	const link = path.join(here, "node_modules", "shared-lib");
	try {
		fs.lstatSync(link);
		return;
	} catch {
		// Not linked yet.
	}
	fs.mkdirSync(path.dirname(link), { recursive: true });
	try {
		fs.symlinkSync(path.join(here, "shared-lib"), link, "junction");
	} catch (error) {
		// Another process linked it first.
		if (error?.code !== "EEXIST") throw error;
	}
}
