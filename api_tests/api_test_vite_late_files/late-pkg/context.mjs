/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /context.mjs
 *	@Date: 2026-11-06T19:31:26-08:00 (1794022286)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T19:39:55-08:00 (1794022795)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A context from a package that did not create the instance, which the host imports only after the
 * instance exists (#714), as rummage imports an extension's `main`.
 * @module late-pkg.context
 */

/**
 * Build the context.
 * @param {object} api - The bound api the host's `slothlet()` call returned.
 * @returns {Record<string, Function>} The context.
 */
export function makeContext(api) {
	return {
		pin: (fn) => typeof api.slothlet.lockCaller(fn),
		meta: () => api.slothlet.metadata.caller()?.apiPath ?? null,
		emit: () => {
			api.slothlet.event.emit("host:ping", { n: 1 });
			return "emitted";
		},
		hostLeaf: () => api.host.echo("x")
	};
}
