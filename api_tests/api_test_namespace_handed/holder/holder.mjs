/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_namespace_handed/holder/holder.mjs
 *	@Date: 2026-11-08T00:56:22-08:00 (1794128182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T01:00:32-08:00 (1794128432)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module handed the framework's namespace as the host holds it, rather than reading it through `self`.
 * @module api_test_namespace_handed/holder
 */

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * attempt(() => {}); // "done"
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
 * Change the namespace it was handed, and a member of it, every way plain JS changes an object.
 * @param {object} ns - The framework namespace, as the host handed it.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeHanded(api.slothlet); // { assign: "PERMISSION_DENIED", … }
 */
export function changeHanded(ns) {
	const key = Symbol.for("slothlet.test.namespaceHanded");
	return {
		assign: attempt(() => {
			ns.planted = 1;
		}),
		define: attempt(() => {
			Object.defineProperty(ns, "defined", { value: 1, configurable: true });
		}),
		remove: attempt(() => {
			delete ns.version;
		}),
		symbol: attempt(() => {
			ns[key] = 1;
		}),
		deep: attempt(() => {
			ns.api.planted = 1;
		}),
		deepRemove: attempt(() => {
			delete ns.api.add;
		}),
		setPrototype: attempt(() => {
			Object.setPrototypeOf(ns, null);
		}),
		close: attempt(() => {
			Object.preventExtensions(ns);
		})
	};
}

/**
 * Change the namespace held inside plain data it was handed.
 * @param {{ns: object}} box - Plain data holding the namespace.
 * @returns {string} The outcome.
 * @example
 * changeBoxed({ ns: api.slothlet }); // "PERMISSION_DENIED"
 */
export function changeBoxed(box) {
	return attempt(() => {
		box.ns.boxed = 1;
	});
}
