/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_code/extension/restore.mjs
 *	@Date: 2026-10-16T19:30:00-07:00 (1792204200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T19:30:00-07:00 (1792204200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An extension in the shape of CLDMV/jellytagger#3 (#597): it runs its own work under the key
 * store's lock, and that work calls the api. Those calls are the extension's, not the key store's.
 *
 * @module api_tests/api_test_caller_supplied_code/extension/restore
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run work under the key store's lock that reports who the vault sees calling it.
 * @returns {Promise<{name: string, holder: string|null, result: *}>} The key store's report.
 * @public
 * @example
 * await api.extension.restore.underLock();
 */
export async function underLock() {
	return self.keystore.key.lock("restore", () => self.vault.secret.whoami());
}

/**
 * Run work under the key store's lock that reports who the vault sees calling it after an `await` of its own.
 * @returns {Promise<{name: string, holder: string|null, result: *}>} The key store's report.
 * @public
 * @example
 * await api.extension.restore.underLockAfterAwait();
 */
export async function underLockAfterAwait() {
	return self.keystore.key.lock("restore", async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
		return self.vault.secret.whoami();
	});
}
