/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/relayed-instances.browser.test.mjs
 *	@Date: 2026-11-16T01:00:00-08:00 (1794819600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:08-08:00 (1794882488)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In a browser, an instance's method is held to the instance it was read from, as in Node.
 *
 * @description
 * Runs in a real browser. In-memory modules: `vault` holds the secret, `bag` hands out instances of a class whose
 * method reads it, `runner` runs methods inside a call that was handed something, and `ext`, refused the vault, calls
 * `runner`. A method of the caller's instance called on the leaf's instance, and the leaf's method called on the
 * caller's instance, are refused: neither is the leaf's instance's own method run on it. Each instance's method is its
 * own function, read twice the same one.
 * @module tests/browser/relayed-instances
 */

import { describe, it, expect } from "vitest";
import { self } from "@cldmv/slothlet/runtime";

describe("browser per-instance methods", () => {
	/**
	 * Build the instance.
	 * @param {"eager"|"lazy"} mode - The mode.
	 * @returns {Promise<object>} The api.
	 */
	const boot = async (mode) => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const api = await slothlet({
			loader: {
				platform: "browser"
			},
			mode,
			silent: true,
			permissions: {
				policy: "allow",
				rules: [
					{ caller: "**", target: "vault.**", effect: "deny" },
					{ caller: "bag.**", target: "vault.**", effect: "allow" },
					{ caller: "runner.**", target: "vault.**", effect: "allow" }
				]
			}
		});
		class Client {
			run() {
				return self.vault.get();
			}
		}
		const settle = async (fn) => {
			try {
				return await fn();
			} catch (error) {
				return error?.code ?? String(error?.message ?? error);
			}
		};
		await api.slothlet.api.add("vault", { exports: { get: () => "SECRET" } }, { id: "vault" });
		await api.slothlet.api.add("bag", { exports: { inst: () => new Client() } }, { id: "bag" });
		await api.slothlet.api.add(
			"runner",
			{
				exports: {
					instCall: async (fn) => fn.call(await self.bag.inst()),
					instForeign: async (receiver) => {
						const own = await self.bag.inst();
						return own.run.call(receiver);
					}
				}
			},
			{ id: "runner" }
		);
		await api.slothlet.api.add(
			"ext",
			{
				exports: {
					probe: async (route) => {
						const mine = await self.bag.inst();
						if (route === "call") return settle(() => self.runner.instCall(mine.run));
						if (route === "foreign") return settle(() => self.runner.instForeign(mine));
						return "no such route";
					}
				}
			},
			{ id: "ext" }
		);
		return api;
	};

	for (const mode of ["eager", "lazy"]) {
		it(`refuses a method of another instance called on the leaf's instance, and the leaf's method called on another (${mode})`, async () => {
			const api = await boot(mode);
			try {
				expect(await api.ext.probe("call")).toBe("PERMISSION_DENIED");
				expect(await api.ext.probe("foreign")).toBe("PERMISSION_DENIED");
			} finally {
				await api.shutdown();
			}
		});

		it(`hands each instance its own method, the same one each read (${mode})`, async () => {
			const api = await boot(mode);
			try {
				const first = await api.bag.inst();
				const second = await api.bag.inst();
				expect(first.run).toBe(first.run);
				expect(first.run).not.toBe(second.run);
				expect(await first.run()).toBe("SECRET");
			} finally {
				await api.shutdown();
			}
		});
	}
});
