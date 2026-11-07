/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/api/runner/runner.mjs
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
 * @fileoverview A module whose `activate` is handed a context the host built and calls each of its functions, as an
 * extension's `activate` does (#714).
 * @module api_test_vite_late_files.runner
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
