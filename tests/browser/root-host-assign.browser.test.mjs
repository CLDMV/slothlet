/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/root-host-assign.browser.test.mjs
 *	@Date: 2026-11-16T00:59:40-08:00 (1794819580)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:09-08:00 (1794882489)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In a browser, an object the host assigns directly on the api root is held to the rules beneath it, as
 * in Node.
 * @module tests/browser/root-host-assign
 */

import { describe, it, expect } from "vitest";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a check, answering what it returned, or the code of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

describe.each(["eager", "lazy"].flatMap((mode) => ["precise", "fast"].map((attribution) => ({ mode, attribution }))))(
	"browser host assignment on the api root > $mode / $attribution",
	({ mode, attribution }) => {
		const boot = async (rules) => {
			const mod = await import("@cldmv/slothlet");
			const slothlet = mod.default ?? mod.slothlet;
			const api = await slothlet({
				loader: {
					platform: "browser"
				},
				mode,
				silent: true,
				permissions: {
					policy: "deny",
					caller: {
						attribution
					},
					rules: [{ caller: "reader.**", target: "reader.**", effect: "allow" }, ...rules]
				}
			});
			await api.slothlet.api.add(
				"reader",
				{
					exports: {
						routes: () => ({
							read: answer(() => self.ownNothing.a),
							keys: answer(() => Object.keys(self.ownNothing)),
							json: answer(() => JSON.stringify(self.ownNothing)),
							write: answer(() => {
								self.ownNothing.a = 9;
								return "wrote";
							})
						})
					}
				},
				{ id: "reader" }
			);
			api.ownNothing = { a: 1 };
			return api;
		};

		it("refuses a reader no rule allows what is beneath it", async () => {
			const api = await boot([]);
			expect(await api.reader.routes()).toEqual({
				read: { threw: "PERMISSION_DENIED" },
				keys: [],
				json: "{}",
				write: { threw: "LOOSE_SET_NOT_OWNED" }
			});
			expect(api.ownNothing.a).toBe(1);
			await api.shutdown();
		});

		it("gives an allowed reader what plain JavaScript gives, and refuses its write", async () => {
			const api = await boot([
				{ caller: "reader.**", target: "ownNothing", effect: "allow" },
				{ caller: "reader.**", target: "ownNothing.**", effect: "allow" }
			]);
			const twin = { a: 1 };
			expect(await api.reader.routes()).toEqual({
				read: twin.a,
				keys: Object.keys(twin),
				json: JSON.stringify(twin),
				write: { threw: "LOOSE_SET_NOT_OWNED" }
			});
			await api.shutdown();
		});
	}
);
