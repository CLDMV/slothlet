/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vm_recompiled/trustedesm/ops.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An ES module that may call the vault's secret. The reader compiles copies of this file's exact source
 * under its URL; those copies are the reader's code, not this module's.
 *
 * @module api_tests/api_test_vm_recompiled/trustedesm/ops
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the vault's secret.
 * @returns {string} The secret.
 * @public
 * @example
 * api.trustedesm.ops.read(); // "s3cret"
 */
export function read() {
	return self.vault.secret.secret();
}

/**
 * Report who the vault sees.
 * @returns {string|null} The caller's api path.
 * @public
 * @example
 * api.trustedesm.ops.who(); // "trustedesm.ops.who"
 */
export function who() {
	return self.vault.secret.whoami();
}

/**
 * Run a function handed in.
 * @param {Function} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.trustedesm.ops.run(() => 1); // 1
 */
export function run(fn) {
	return fn();
}
