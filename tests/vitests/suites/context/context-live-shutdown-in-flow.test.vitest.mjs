/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/context-live-shutdown-in-flow.test.vitest.mjs
 *	@Date: 2026-11-25T01:54:16-08:00 (1795600456)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:26-08:00 (1795869086)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An instance shut down from inside a `run()` / `scope()` flow of its own on the live runtime.
 *
 * @description
 * The live runtime keeps one store per instance plus one per open `run()` / `scope()` flow, and the flow being run is
 * the active one. A `shutdown()` asked for in a `run()` / `scope()` acts on the run's own copy (docs/CONTEXT-PROPAGATION.md,
 * "What a flow asks of the instance"): it completes, the flow's callback returns what it returned, and the instance
 * itself still answers calls afterwards.
 * @module tests/vitests/suites/context/context-live-shutdown-in-flow
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_self_handed_out_objroot/api");

describe("Context > live runtime > shutdown from inside a flow", () => {
	it.each(["run", "scope"])("completes from inside %s(), acting on the flow's own copy: the instance stays up", async (form) => {
		const api = await slothlet({ base: BASE, runtime: "live", silent: true });
		try {
			expect(await api.math.add(1, 2)).toBe(3);
			const fn = async () => {
				await api.shutdown();
				return "closed";
			};
			const result =
				form === "run"
					? await api.slothlet.context.run({ tenant: "a" }, fn)
					: await api.slothlet.context.scope({ context: { tenant: "a" }, fn });
			expect(result).toBe("closed");
			expect(await api.math.add(2, 3)).toBe(5);
		} finally {
			await api.shutdown();
		}
	});
});
