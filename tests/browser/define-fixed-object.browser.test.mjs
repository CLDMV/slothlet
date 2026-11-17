/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/define-fixed-object.browser.test.mjs
 *	@Date: 2026-11-16T05:00:00-08:00 (1794834000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:57-08:00 (1794882537)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In a browser, as in Node, a member defined read-only and non-configurable holding an object in one step
 * is refused while the permission system is on, and defined as in plain JavaScript while it is off; assigned and then
 * locked, it stays checked beneath.
 * @module tests/browser/define-fixed-object
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

/**
 * Run a definition, answering what it returned, or the code of what it threw and whether that is a `TypeError`.
 * @param {function(): *} define - The definition.
 * @returns {*} Its answer, or `{ threw, typeError }`.
 */
function defined(define) {
	try {
		return define();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw", typeError: error instanceof TypeError };
	}
}

const FIXED = { writable: false, configurable: false, enumerable: true };

describe.each(["eager", "lazy"].flatMap((mode) => ["on", "off"].map((permissionMode) => ({ mode, permissionMode }))))(
	"browser one-step fixed definitions > $mode / permissions $permissionMode",
	({ mode, permissionMode }) => {
		const on = permissionMode === "on";

		const boot = async () => {
			const mod = await import("@cldmv/slothlet");
			const slothlet = mod.default ?? mod.slothlet;
			const api = await slothlet({
				platform: "browser",
				mode,
				silent: true,
				permissions: {
					mode: permissionMode,
					defaultPolicy: "allow",
					rules: [{ caller: "reader.**", target: "owner.data.locked.hidden", effect: "deny" }]
				}
			});
			await api.slothlet.api.add(
				"owner",
				{
					exports: {
						data: { pub: 1 },
						define: (key) => defined(() => Reflect.defineProperty(self.owner.data, key, { value: { v: 1 }, ...FIXED })),
						lock: () => {
							self.owner.data.locked = { v: 1, hidden: "H" };
							return Reflect.defineProperty(self.owner.data, "locked", { writable: false, configurable: false });
						}
					}
				},
				{ moduleID: "owner" }
			);
			await api.slothlet.api.add(
				"reader",
				{ exports: { probe: () => ({ hidden: answer(() => self.owner.data.locked.hidden), v: answer(() => self.owner.data.locked.v) }) } },
				{ moduleID: "reader" }
			);
			return api;
		};

		it("refuses the one-step definition while on, by the host and a module, and allows a primitive", async () => {
			const api = await boot();
			const refused = { threw: "PERMISSION_MEMBER_FIXED_OBJECT", typeError: true };
			expect(defined(() => Object.defineProperty(api, "rootFixed", { value: { v: 1 }, ...FIXED }) === api)).toEqual(on ? refused : true);
			expect(defined(() => Reflect.defineProperty(api.owner.data, "hostFixed", { value: { v: 1 }, ...FIXED }))).toEqual(
				on ? refused : true
			);
			expect(await api.owner.define("moduleFixed")).toEqual(on ? refused : true);
			expect(Reflect.defineProperty(api.owner.data, "prim", { value: "P", ...FIXED })).toBe(true);
			expect(api.owner.data.prim).toBe("P");
			await api.shutdown();
		});

		it("keeps a member assigned and then locked checked beneath", async () => {
			const api = await boot();
			expect(await api.owner.lock()).toBe(true);
			expect(await api.reader.probe()).toEqual(on ? { hidden: { threw: "PERMISSION_DENIED" }, v: 1 } : { hidden: "H", v: 1 });
			await api.shutdown();
		});
	}
);
