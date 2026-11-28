/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_attribution_generator_steps/supplier/steps.mjs
 *	@Date: 2026-11-27T00:00:00-08:00 (1795766400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T00:00:00-08:00 (1795766400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The supplier for the generator-step attribution tests: it may call the callee but not the vault, and
 * steps the callee's generators.
 *
 * @module api_tests/api_test_attribution_generator_steps/supplier/steps
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
 * Step the callee's generator one way.
 * @param {string} how - "spread", "next" or "forOf".
 * @returns {Promise<*>} What the first step yielded, or the refusal's code.
 * @public
 * @example
 * await api.supplier.steps.sync("spread"); // "PERMISSION_DENIED"
 */
export function sync(how) {
	return attempt(() => {
		const generator = self.callee.gen.makeGen();
		switch (how) {
			case "spread":
				return [...generator][0];
			case "next":
				return generator.next().value;
			case "forOf":
				for (const value of generator) return value;
				return null;
			default:
				throw new Error(`unknown step ${how}`);
		}
	});
}

/**
 * Step the callee's async generator one way.
 * @param {string} how - "next", "forAwait" or "fromAsync".
 * @returns {Promise<*>} What the first step yielded, or the refusal's code.
 * @public
 * @example
 * await api.supplier.steps.async("forAwait"); // "PERMISSION_DENIED"
 */
export function async(how) {
	return attempt(async () => {
		const generator = self.callee.gen.makeAsyncGen();
		switch (how) {
			case "next":
				return (await generator.next()).value;
			case "forAwait":
				for await (const value of generator) return value;
				return null;
			case "fromAsync":
				return (await Array.fromAsync(generator))[0];
			default:
				throw new Error(`unknown step ${how}`);
		}
	});
}
