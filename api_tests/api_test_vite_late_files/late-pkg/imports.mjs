/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /imports.mjs
 *	@Date: 2026-11-06T19:31:26-08:00 (1794022286)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T19:39:56-08:00 (1794022796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file of the same package that imports another (#714): its own code runs after its import resolves.
 * @module late-pkg.imports
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
