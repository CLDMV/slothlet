/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_isolation/outer/root.mjs
 *	@Date: 2026-08-18 12:00:00 -07:00 (1787079600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-18 12:00:00 -07:00 (1787079600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Leaf of the OUTER (permissioned) api that boots a SECOND, independent slothlet
 * instance from inside its own body — the documented multi-instance pattern. When the host calls
 * `api.root.boot(...)`, this leaf executes as the ambient caller (`root.boot`), so the nested
 * instance's own construction runs while an outer-instance caller is active. That is the exact
 * shape of #290: without per-instance caller isolation the nested boot is wrongly enforced against
 * the outer caller and throws PERMISSION_DENIED on its own `slothlet.*` internals.
 *
 * The nested instance is booted with the SAME runtime as the outer so both share the outer's
 * context manager (async and live are separate singletons); a mismatched runtime would not carry
 * the outer's ambient caller into the nested boot and so would not exercise the bug.
 * @module api_test_nested_isolation.outer.root
 * @memberof module:api_test_nested_isolation
 */

import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";

const innerDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "inner");

/**
 * Boot a nested instance, probe it, and tear it down.
 * @param {"async"|"live"} [runtime] - Runtime for the nested instance (matched to the outer).
 * @param {object|null} [permissions] - Optional permissions config for the nested instance.
 * @returns {Promise<{booted: boolean, probe: *}>} Boot result and the nested leaf's return value.
 */
async function bootNested(runtime, permissions) {
	const nested = await slothlet({
		base: innerDir,
		mode: "eager",
		runtime,
		...(permissions ? { permissions } : {})
	});
	try {
		return { booted: true, probe: await nested.thing.isAiPdf() };
	} finally {
		await nested.shutdown();
	}
}

/**
 * Boot an UNPERMISSIONED nested instance from inside this permissioned outer leaf.
 * @param {"async"|"live"} [runtime] - Runtime for the nested instance (matched to the outer).
 * @returns {Promise<{booted: boolean, probe: *}>}
 */
export async function boot(runtime) {
	return bootNested(runtime, null);
}

/**
 * Boot a DEFAULT-DENY nested instance from inside this permissioned outer leaf. Exercises the
 * second internal-namespace read site (`slothlet.then` during buildFinalAPI), which the ownership
 * walk alone does not reach.
 * @param {"async"|"live"} [runtime] - Runtime for the nested instance (matched to the outer).
 * @returns {Promise<{booted: boolean, probe: *}>}
 */
export async function bootDeny(runtime) {
	return bootNested(runtime, {
		defaultPolicy: "deny",
		rules: [{ caller: "**", target: "thing.**", effect: "allow" }]
	});
}
