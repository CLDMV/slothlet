/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/api/ext/a.mjs
 *	@Date: 2026-11-05T16:46:21-08:00 (1793925981)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T16:51:28-08:00 (1793926288)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The module of the host-owner attribution tests (#714). Its `activate` is handed a context the host
 * built and calls each of the context's functions, the way an extension's `activate` calls `ctx.commands.register`:
 * the host's code then runs inside this module's call.
 * @module api_test_host_owner_code.ext.a
 */

/**
 * Call every function of a host-built context and report what each gave.
 * @param {Record<string, Function>} ctx - The host-built context.
 * @returns {Promise<Record<string, {ok: boolean, value?: unknown, code?: string, caller?: string|null}>>} The outcomes.
 */
export async function activate(ctx) {
	const results = {};
	for (const [name, fn] of Object.entries(ctx)) {
		try {
			results[name] = { ok: true, value: await fn(() => "handler") };
		} catch (error) {
			results[name] = { ok: false, code: error?.code, caller: error?.context?.caller ?? null };
		}
	}
	return results;
}
