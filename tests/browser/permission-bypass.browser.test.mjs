/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/permission-bypass.browser.test.mjs
 *	@Date: 2026-07-29 12:00:00 -07:00 (1785351600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-29 12:00:00 -07:00 (1785351600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Permission-bypass routes running in a real headless browser.
 *
 * @description
 * The `platform:"browser"` suite proves these routes in Node with the browser code paths forced.
 * That is not sufficient on its own here: the live manager falls back to reading the **call stack**
 * to tell two concurrently-suspended callers apart, and a stack is an engine artifact — its text
 * format differs between engines, and in a browser a module's identity is a URL rather than a
 * filesystem path. Only a real browser proves the fallback actually resolves.
 *
 * If this ever regresses, the failure mode is an unprivileged module inheriting a concurrent
 * caller's rights — silently.
 *
 * @module tests/browser/permission-bypass.browser
 */

import { describe, it, expect } from "vitest";
// Node-built (filesystem) fixture manifest, injected by the browser config.
import { manifest, fixtureRel } from "virtual:browser-fixture-manifest";

describe("browser permission bypass routes", () => {
	/**
	 * `math.**` is permitted to `probe.**` and denied to everyone else.
	 * @returns {Promise<object>} A bound browser-mode api.
	 */
	const boot = async () => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const BASE = new URL("/" + fixtureRel + "/", location.origin).href;
		return slothlet({
			platform: "browser",
			base: BASE,
			manifest,
			resolveModuleSpecifier: ({ path }) => new URL(path, BASE).href,
			mode: "eager",
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "probe.**", target: "math.**", effect: "allow" },
					{ caller: "**", target: "{probe,rogue}.**", effect: "allow" }
				]
			}
		});
	};

	it("denies an unprivileged call directly, after a microtask, and after a timer", async () => {
		const api = await boot();
		try {
			expect(await api.rogue.callDirect()).toBe("denied");
			expect(await api.rogue.callAfterAwait()).toBe("denied");
			expect(await api.rogue.callAfterTimer()).toBe("denied");
		} finally {
			await api.shutdown();
		}
	});

	/**
	 * Poll a synchronous accessor on the api until it reports an outcome.
	 * @param {Function} read - Bound accessor.
	 * @returns {Promise<string|null>} The outcome, or null if it never arrived.
	 */
	const poll = async (read) => {
		for (let attempt = 0; attempt < 200; attempt++) {
			const outcome = await read();
			if (outcome) return outcome;
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		return null;
	};

	it("denies work an unprivileged module defers onto a timer and returns from", async () => {
		const api = await boot();
		try {
			expect(await api.rogue.armTimerRead()).toBe("armed");
			expect(await poll(api.rogue.readTimerOutcome)).toBe("denied");
		} finally {
			await api.shutdown();
		}
	});

	it("denies a DOM listener the page dispatches, registered by an unprivileged module", async () => {
		const api = await boot();
		try {
			expect(await api.rogue.armDomListener()).toBe("armed");

			// Dispatched from the page, so nothing of the module's is in flight to lend the listener an
			// identity — the browser's own boundary is the only thing carrying it.
			globalThis.__slothletProbeTarget.dispatchEvent(new Event("probe"));

			expect(await poll(api.rogue.readDomOutcome)).toBe("denied");
		} finally {
			await api.shutdown();
			delete globalThis.__slothletProbeTarget;
		}
	});

	it("resolves the true caller from the stack when two callers are suspended at once", async () => {
		const api = await boot();
		try {
			let release;
			const gate = new Promise((resolve) => (release = resolve));

			// Unprivileged enters first so the privileged caller is the most recent occupant of the
			// ambient identity field by the time either resumes.
			const settled = Promise.all([api.rogue.gatedCall(gate), api.probe.gatedCall(gate)]);
			release();
			const [rogue, probe] = await settled;

			expect(rogue).toBe("denied");
			expect(probe).toBe(3);
		} finally {
			await api.shutdown();
		}
	});
});
