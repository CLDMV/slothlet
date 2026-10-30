/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7/relhelp/add.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The helper a module adds another through (#597): the folder it is given is relative to this file.
 *
 * @module api_tests/api_test_caller_supplied_round7/relhelp/add
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Add a module from a folder relative to this file, leaving it the vault on `globalThis`.
 * @param {string} folder - The folder, relative to this file.
 * @param {string} name - Where to mount it, and its moduleID's stem.
 * @returns {Promise<string>} What the calling module reads after the add settles.
 * @public
 * @example
 * await addFrom("lib", "relplug"); // "s3cret"
 */
export async function addFrom(folder, name) {
	globalThis.__slothletRound7Vault = self.vault;
	await self.slothlet.api.add(name, folder, { moduleID: `${name}-mod` });
	return self.vault.secret.secret();
}
