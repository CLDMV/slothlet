/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity/d/d.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A call that resumes after an overlapping call has settled, while another instance exists.
 * @module api_test_live_caller_identity.d
 */
import { self, context } from "@cldmv/slothlet/runtime";

/**
 * Read `self`, `metadata.self()` and `lockCaller()` after an await, through references taken before it.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<{tag: *, selfAfterAwait: string, metadataSelf: string|null, lockCallerPinned: boolean, served: {pinned: boolean}}>} What resolved.
 */
export async function resume(gate) {
	const svc = self.svc;
	const meta = self.slothlet.metadata;
	const lockCaller = self.slothlet.lockCaller;
	await gate;
	// The instance's own context, as the `context` binding resolves it after the await.
	const tag = context.tag;
	let selfAfterAwait;
	try {
		selfAfterAwait = self.svc ? "resolved" : "missing";
	} catch (error) {
		selfAfterAwait = error.code;
	}
	let metadataSelf;
	try {
		metadataSelf = meta.self()?.apiPath ?? null;
	} catch (error) {
		metadataSelf = error.code;
	}
	const fn = () => 0;
	const lockCallerPinned = lockCaller(fn) !== fn;
	const { cb } = await svc.take(fn);
	return { tag, selfAfterAwait, metadataSelf, lockCallerPinned, served: { pinned: cb !== fn } };
}
