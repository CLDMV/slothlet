/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/host/context.mjs
 *	@Date: 2026-11-05T20:15:16-08:00 (1793938516)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T20:16:36-08:00 (1793938596)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The context a host hands a module from its own source folder (#714): closures that reach the instance
 * through the host's own `api` handle, as rummage's `ctx.commands.register` (a `lockCaller` pin), its
 * `slothlet.metadata` and `slothlet.event` calls and its `host.*` leaves do. Under vitest a test imports it, so vite
 * transforms it, as it does a host's own files.
 * @module api_test_host_owner_code.host.context
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
