/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-kept-every-use.test.vitest.mjs
 *	@Date: 2026-10-25T09:27:44-07:00 (1792945664)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T11:38:54-07:00 (1792953534)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live runtime: every use of a module's kept node — reading, listing, describing, serializing,
 * spreading, calling — from a callback slothlet does not patch, after calling a kept async function (#661).
 *
 * The kept node answers as its reader, in the live runtime as in the async one: for plain data, and for a namespace
 * another module made callable after it was kept (#533).
 *
 * Fixture: `api_tests/api_test_live_kept_gaps` — `base/` (store, other, probe), `ns_values/`, `ns_callable/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = new URL("../../../../api_tests/api_test_live_kept_gaps", import.meta.url).pathname;

/**
 * Poll the probe's outcome.
 * @param {object} api - The api.
 * @returns {Promise<object|null>} The outcome.
 */
const waitOutcome = async (api) => {
	for (let tries = 0; tries < 200; tries++) {
		const outcome = await api.probe.result();
		if (outcome) return outcome;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return null;
};

describe.each([{ mode: "eager" }, { mode: "lazy" }])(
	"every use of a kept node after a kept async call from a timer (#661) — $mode",
	({ mode }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Build an instance, mount what the case needs, keep the node, and use it from a timer.
		 * @param {string} name - `obj`, `farr` or `ns`.
		 * @param {string} runtime - `async` or `live`.
		 * @returns {Promise<object>} What the uses gave.
		 */
		async function useKept(name, runtime) {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions: { defaultPolicy: "allow" } });
			if (name === "ns") await api.slothlet.api.add("mounts.ns", path.join(FIXTURE, "ns_values"), { moduleID: "values" });
			await api.probe.keep(name);
			// Made callable after it was kept (#533).
			if (name === "ns") await api.slothlet.api.add("mounts.ns", path.join(FIXTURE, "ns_callable"), { moduleID: "callable" });
			await api.probe.useLater();
			const outcome = await waitOutcome(api);
			await api.shutdown();
			api = null;
			return outcome;
		}

		it.each([
			["plain data", "obj", { read: 1, keys: JSON.stringify(["n", "inner"]), json: 1, spread: 1 }],
			["a namespace made callable after it was kept", "ns", { read: 3, keys: JSON.stringify(["n"]), spread: 3 }],
			["a frozen array", "farr", { read: 1, keys: JSON.stringify(["0", "1"]), json: 1, spread: 1 }]
		])("%s answers in the live runtime as in the async one", async (_label, name, expected) => {
			const reference = await useKept(name, "async");
			expect(reference).toMatchObject(expected);
			expect(await useKept(name, "live")).toEqual(reference);
		});
	}
);
