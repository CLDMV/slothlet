/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-unknown-caller.test.vitest.mjs
 *	@Date: 2026-11-09T02:00:00-08:00 (1794222000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T02:00:00-08:00 (1794222000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #726 — a `self` call whose caller cannot be determined is refused with `PERMISSION_DENIED`, whatever
 * its definer may do. It never runs as the host, and never as one of the calls it could be.
 *
 * @description
 * Fixture `api_test_unknown_caller`: `ext.start` and `ext.peer.wait` are two api paths of one module, and both import
 * `resume.mjs`, where `ext.start`'s work resumes after its gate. With both suspended, the live runtime's stack cannot
 * tell which of them is running there, so the caller is unknown:
 *
 * - **`self`** — `resume.mjs` reaches `ext.views.running.render` and `ext.cache.context.subscribe` through `self`. Its definer
 *   (`ext.resume.afterGate`) may call both; the caller is unknown, so each call is refused.
 * - **`handed`** — the host reads `ext` and hands it in; `resume.mjs` calls `views.running.render` on it (not loaded yet
 *   under lazy) through a helper in a hidden folder, whose frames name no definer. The call is refused. Under lazy the node
 *   loads after `ext.peer.wait` has settled, when nothing is left to tell the call apart from: the load does not make
 *   the host its caller.
 *
 * The async runtime keeps each call's caller in its own flow, so the caller there is `ext.start` and both reach their
 * targets. Every case runs from the host directly and from the host's module `run.chain`, a frame of another module
 * further out, under both `permissions.attribution` values, eager and lazy, async and live.
 *
 * @module tests/vitests/suites/permissions/permissions-unknown-caller
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_unknown_caller");

/** Deny by default; the extension may reach its own leaves, and anyone may start it. */
const RULES = [
	{ caller: "ext.**", target: "ext.**", effect: "allow" },
	{ caller: "**", target: "ext.start", effect: "allow" },
	{ caller: "**", target: "ext.peer.wait", effect: "allow" }
];

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/**
 * A promise and the function that releases it.
 * @returns {[Promise<void>, Function]} Gate and release.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => (release = resolve));
	return [promise, release];
}

/**
 * Let pending microtasks and a few timer turns run, so a lazy node's load settles.
 * @returns {Promise<void>} Resolves after them.
 */
async function settle() {
	for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe.each(MATRIX)("Permissions > a caller that cannot be determined is refused > $name (#726)", ({ attribution, mode, runtime }) => {
	let api = null;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	/**
	 * Build the host and mount the extension.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({
			base: ROOT,
			mode,
			runtime,
			hidden: ["ext", "shared"],
			silent: true,
			permissions: { defaultPolicy: "deny", attribution, rules: RULES }
		});
		await api.slothlet.api.add(["ext"], `${ROOT}/ext/api`);
		return api;
	};

	/**
	 * Run a scenario of `ext.start` while `ext.peer.wait` is suspended too.
	 * @param {string} scenario - `"self"` or `"handed"`.
	 * @param {boolean} chained - Start it through the host's module `run.chain`.
	 * @returns {Promise<*>} What the scenario returned.
	 */
	const run = async (scenario, chained) => {
		await build();
		const target = scenario === "handed" ? api.ext : undefined;
		const [startGate, releaseStart] = gate();
		const [peerGate, releasePeer] = gate();
		const started = chained ? api.run.chain(scenario, startGate, target) : api.ext.start(scenario, startGate, target);
		await settle();
		const waiting = api.ext.peer.wait(peerGate);
		await settle();
		// Both released together: `ext.start` resumes first, while `ext.peer.wait` is still suspended, and `ext.peer.wait`
		// settles before a lazy node `ext.start` asked for has loaded.
		releaseStart();
		releasePeer();
		expect(await waiting).toBe("waited");
		return started;
	};

	describe.each([
		["from the host", false],
		["through run.chain, a frame of another module further out", true]
	])("%s", (_label, chained) => {
		it("self: each call is refused while the caller cannot be told, though its definer may make it", async () => {
			const expected = runtime === "live" ? ["denied", "denied"] : ["rendered:self", "subscribed"];
			expect(await run("self", chained)).toEqual(expected);
		});

		it("handed: a node the host read, called from code no leaf holds, is refused, and its load does not make the host the caller", async () => {
			const expected = runtime === "live" ? "denied" : "rendered:handed";
			expect(await run("handed", chained)).toBe(expected);
		});
	});
});
