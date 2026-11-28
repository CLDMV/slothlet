/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_attribution_generator_steps/callee/gen.mjs
 *	@Date: 2026-11-27T00:00:00-08:00 (1795766400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:31-08:00 (1795868851)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The callee for the generator-step attribution tests: it may call the vault's secret and exports a
 * generator and an async generator whose bodies call it.
 *
 * @module api_tests/api_test_attribution_generator_steps/callee/gen
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * A generator yielding the secret.
 * @returns {Generator<string>} The generator.
 * @public
 * @example
 * [...api.callee.gen.makeGen()]; // ["s3cret"]
 */
export function* makeGen() {
	yield self.vault.secret.secret();
}

/**
 * An async generator yielding the secret.
 * @returns {AsyncGenerator<string>} The generator.
 * @public
 * @example
 * for await (const value of api.callee.gen.makeAsyncGen()) value; // "s3cret"
 */
export async function* makeAsyncGen() {
	yield self.vault.secret.secret();
}

/**
 * Step the callee's own generator, as the callee.
 * @returns {string} The secret.
 * @public
 * @example
 * api.callee.gen.ownSpread(); // "s3cret"
 */
export function ownSpread() {
	return [...makeGen()][0];
}

/**
 * Step the callee's own async generator, as the callee.
 * @returns {Promise<string>} The secret.
 * @public
 * @example
 * await api.callee.gen.ownAsync(); // "s3cret"
 */
export async function ownAsync() {
	for await (const value of makeAsyncGen()) return value;
	return null;
}

/**
 * Step the callee's generator, got through `self`, as the callee.
 * @returns {string} The secret.
 * @public
 * @example
 * api.callee.gen.selfSpread(); // "s3cret"
 */
export function selfSpread() {
	return [...self.callee.gen.makeGen()][0];
}
