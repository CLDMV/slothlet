/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_package_record/table.mjs
 *	@Date: 2026-11-15T15:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T15:00:00-08:00 (1794787200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The package table of `api/`: the shipper module's packages read the vault inside the shipper's own call
 * and inside the runner's call (handed there by the shipper), with nothing denied and with each module denied in turn,
 * in eager and lazy mode, in both runtimes and under both attributions.
 * @module api_tests/api_test_vite_package_record/table
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "api");

/** The configurations, as `<attribution> <mode>/<runtime>`. */
export const CONFIGS = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) CONFIGS.push({ attribution, mode, runtime });

/** The modules denied the vault in turn, `null` for none. */
export const DENIED = [null, "shipper", "runner"];

/** The reads: inside the shipper's own call, and inside the runner's call. */
export const READS = ["own", "handed"];

/** The packages. */
export const KINDS = ["cjs", "esm"];

/**
 * Run a function, giving back what it returns or the code of the error it threw.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} The outcome.
 */
async function settle(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

/**
 * Build the table with a given `slothlet` function.
 * @param {Function} slothlet - The slothlet factory.
 * @returns {Promise<Object<string, string>>} Outcomes keyed `<attribution> <mode>/<runtime>/<denied>/<read>/<kind>`.
 */
export async function packageTable(slothlet) {
	const out = {};
	for (const { attribution, mode, runtime } of CONFIGS)
		for (const denied of DENIED) {
			const api = await slothlet({
				base: DIR,
				mode,
				runtime,
				silent: true,
				permissions: {
					defaultPolicy: "allow",
					attribution,
					rules: denied ? [{ caller: `${denied}.**`, target: "vault.**", effect: "deny" }] : []
				}
			});
			for (const kind of KINDS) {
				out[`${attribution} ${mode}/${runtime}/${denied}/own/${kind}`] = await settle(() => api.shipper.own(kind));
				const reader = await api.shipper.give(kind);
				out[`${attribution} ${mode}/${runtime}/${denied}/handed/${kind}`] = await settle(() => api.runner.run(reader));
			}
			await api.shutdown();
		}
	return out;
}
