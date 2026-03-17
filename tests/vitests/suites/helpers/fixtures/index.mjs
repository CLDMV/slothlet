/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/fixtures/index.mjs
 *	@Date: 2026-03-17 00:00:00 -07:00 (1773907200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-17 00:00:00 -07:00 (1773907200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Fixture for testing that files named index.mjs are NOT treated
 * as Slothlet-internal by Resolver.#isSlothletInternal().
 *
 * @description
 * Before the fix, #isSlothletInternal() checked basename alone, so ANY file
 * named index.mjs was silently skipped during V8 stack-walking, causing relative
 * dir paths to fall back to process.cwd() instead of resolving from the actual
 * caller's directory.
 *
 * After the fix, the basename check is scoped to SLOTHLET_PKG_ROOT, so only the
 * Slothlet package's own entry-point files are treated as internal.
 *
 * This fixture MUST remain named index.mjs to exercise the bug scenario.
 *
 * @module tests/vitests/suites/helpers/fixtures/index
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resolver } from "@cldmv/slothlet/helpers/resolve-from-caller";

const __filename = fileURLToPath(import.meta.url);

/** @type {string} Absolute path to THIS file's directory (the fixtures/ folder). */
export const FIXTURE_DIR = path.dirname(__filename);

/**
 * Call Resolver.resolvePathFromCaller from within this index.mjs file.
 * Because this file is named index.mjs, the bug (pre-fix) would cause it to
 * be skipped on the V8 stack and resolution would fall through to process.cwd()
 * instead of returning FIXTURE_DIR.
 *
 * @param {string} [rel="."] - Relative path to resolve.
 * @returns {string} The resolved absolute path.
 * @example
 * resolveFromHere("."); // after fix: returns FIXTURE_DIR
 */
export function resolveFromHere(rel = ".") {
	const resolver = new Resolver({});
	return resolver.resolvePathFromCaller(rel);
}
