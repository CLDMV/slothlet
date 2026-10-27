/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_namespace_guard/shared/internals.mjs
 *	@Date: 2026-10-18T15:55:21-07:00 (1792364121)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T16:33:26-07:00 (1792366406)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Changes a module tries to make to the framework's internal keys on an api node (#625):
 * wrapper state (`____slothletInternal`, `_materialize`, …), node information (`__metadata`, `__type`, …),
 * and impl metadata (`__childFilePaths`, …). Shared by `victim` (its own node) and `intruder` (another
 * module's node). Each change reports what happened instead of throwing.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Every framework-internal key an api node carries.
 * @type {string[]}
 */
export const INTERNAL_KEYS = [
	"____slothletInternal",
	"____slothlet",
	"___setImpl",
	"___getState",
	"___resetLazy",
	"___invalidate",
	"__state",
	"__invalid",
	"__mode",
	"__apiPath",
	"__slothletPath",
	"__isCallable",
	"__materializeOnCreate",
	"__displayName",
	"__type",
	"__metadata",
	"__filePath",
	"__sourceFolder",
	"__moduleID",
	"__materialized",
	"__inFlight",
	"__impl",
	"_impl",
	"_materialize",
	"__childFilePaths",
	"__childFilePathsPreMaterialize"
];

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * attempt(() => { node.__type = "x"; });
 */
function attempt(change) {
	try {
		change();
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Assign, define, and delete every internal key on the node at `apiPath`, read through `self`.
 * @param {string} apiPath - Dotted path of the node.
 * @returns {Record<string, string>} Outcome by `"<op> <key>"`.
 * @example
 * changeInternals("victim.v.hello");
 */
export function changeInternals(apiPath) {
	const node = () => apiPath.split(".").reduce((value, key) => value[key], self);
	return runChanges(node);
}

/**
 * Assign, define, and delete every internal key on a node.
 * @param {function(): object} node - Reads the node.
 * @returns {Record<string, string>} Outcome by `"<op> <key>"`.
 * @example
 * runChanges(() => self.victim.v);
 */
function runChanges(node) {
	const out = {};
	for (const key of INTERNAL_KEYS) {
		out[`set ${key}`] = attempt(() => {
			node()[key] = function fake() {
				return "FAKE";
			};
		});
		out[`define ${key}`] = attempt(() => {
			Object.defineProperty(node(), key, { value: () => "FAKE", configurable: true, writable: true, enumerable: false });
		});
		out[`delete ${key}`] = attempt(() => {
			delete node()[key];
		});
	}
	return out;
}

/**
 * Keep the node at `apiPath`, read through `self`, and hand back a function that changes its internal keys
 * later. The host calls that function directly, after the call returned, so no module call is executing.
 * @param {string} apiPath - Dotted path of the node.
 * @returns {function(): Record<string, string>} Changes every internal key of the kept node and reports each outcome.
 * @example
 * keepNode("victim.v")();
 */
export function keepNode(apiPath) {
	const kept = apiPath.split(".").reduce((value, key) => value[key], self);
	return () => runChanges(() => kept);
}
