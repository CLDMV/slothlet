/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/supplier/probe.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The supplier's probes for the fifth round of caller-supplied-code tests (#597): it runs code the
 * callee hands out, which runs as the callee, as the callee's own call through `self` would.
 *
 * @module api_tests/api_test_caller_supplied_round5/supplier/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run something, answering with the error code when refused.
 * @param {function(): *} run - What to run.
 * @returns {Promise<*>} Its result, or the refusal's code.
 * @private
 */
async function attempt(run) {
	try {
		return await run();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Run the code the callee hands out in one of a few shapes.
 * @param {string} name - The shape.
 * @returns {Promise<*>} What the callee's code returned.
 * @public
 * @example
 * await api.supplier.probe.calleeMade("client"); // "s3cret"
 */
export function calleeMade(name) {
	return attempt(() => {
		switch (name) {
			case "client":
				return self.callee.ops.makeClient()();
			case "object":
				return self.callee.ops.makeObject().fn();
			case "instanceMethod":
				return self.callee.ops.makeInstance().secret();
			case "instanceGetter":
				return self.callee.ops.makeInstance().g;
			case "generator":
				return [...self.callee.ops.makeGen()][0];
			case "direct":
				return self.callee.ops.secretDirect();
			case "getterExport":
				return self.callee.box.held.value;
			default:
				throw new Error(`unknown shape ${name}`);
		}
	});
}
