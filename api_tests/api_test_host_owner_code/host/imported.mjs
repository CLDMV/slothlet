/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/host/imported.mjs
 *	@Date: 2026-11-05T20:21:28-08:00 (1793938888)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T20:22:20-08:00 (1793938940)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A host file that imports another (#714). Its own code runs after its imports resolve, so vitest's
 * runner resumes it from the microtask queue rather than calling it directly, as with most of a host's real files.
 * @module api_test_host_owner_code.host.imported
 */
import { makeContext as baseContext } from "./context.mjs";

/**
 * Build the context from closures of this file, beside those of `context.mjs`.
 * @param {object} api - The bound api the host's `slothlet()` call returned.
 * @returns {Record<string, Function>} The context.
 */
export function makeContext(api) {
	const base = baseContext(api);
	return {
		pin: (fn) => typeof api.slothlet.lockCaller(fn),
		meta: () => api.slothlet.metadata.caller()?.apiPath ?? null,
		emit: () => {
			api.slothlet.event.emit("host:ping", { n: 1 });
			return "emitted";
		},
		hostLeaf: () => base.hostLeaf()
	};
}
