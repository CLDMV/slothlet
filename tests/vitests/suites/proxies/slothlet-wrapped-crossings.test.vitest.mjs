/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/slothlet-wrapped-crossings.test.vitest.mjs
 *	@Date: 2026-11-09T20:57:35-08:00 (1794286655)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:30:03-08:00 (1794375003)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.wrapped(value)` (#671) for the wrappers slothlet makes of a module's values as they cross
 * to another module (#667): a checked view of a class prototype, the view or frozen copy of plain data carrying one,
 * the stand-in an emitter reports as its prototype to a module denied it, and a callable node's own `valueOf`. Each is
 * slothlet's own and answers true; wherever the reader is handed the object itself instead, it answers false.
 */

import { describe, it, expect, afterEach } from "vitest";
import { join, resolve } from "node:path";
import { types } from "node:util";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_wrapped_check_crossings");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];

/** Refuses the reader everything of the owner's. */
const DENY_READER = { defaultPolicy: "allow", rules: [{ caller: "reader.**", target: "owner.**", effect: "deny" }] };

/** Grants the reader writes into the owner's subtree. */
const ALLOW_READER_WRITES = { rules: [{ caller: "reader.**", target: "owner.**:write", effect: "allow" }] };

/**
 * A slothlet instance with the owner and reader mounted, both loaded.
 * @param {object} options - Options for slothlet.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, ...options });
	await api.slothlet.api.add("owner", join(FIXTURE, "owner"), { moduleID: "owner" });
	await api.slothlet.api.add("reader", join(FIXTURE, "reader"), { moduleID: "reader" });
	await api.owner;
	await api.reader;
	return api;
}

describe.each(MODES.flatMap((mode) => RUNTIMES.map((runtime) => ({ mode, runtime }))))(
	"Proxies > api.slothlet.wrapped across modules > $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("answers true for the checked view of a prototype a reader may not write, false for the object itself", async () => {
			api = await mount({ mode, runtime, permissions: {} });
			expect(await api.reader.checkPrototype()).toEqual({ prototype: true, method: true });
			await api.shutdown();
			api = await mount({ mode, runtime, permissions: ALLOW_READER_WRITES });
			expect(await api.reader.checkPrototype()).toEqual({ prototype: false, method: false });
			await api.shutdown();
			api = await mount({ mode, runtime });
			expect(await api.reader.checkPrototype()).toEqual({ prototype: false, method: false });
		});

		it("answers true for the view of plain data carrying a prototype handed as an argument", async () => {
			api = await mount({ mode, runtime, permissions: {} });
			expect(await api.owner.giveNested()).toEqual({ proxy: true, frozen: false, box: true, inner: true });
		});

		it("answers true for the view of frozen plain data carrying a prototype", async () => {
			api = await mount({ mode, runtime, permissions: {} });
			expect(await api.owner.giveFrozen()).toEqual({ proxy: true, frozen: true, box: true, inner: true });
		});

		it("answers true for the view of any data another module hands over, and false with permissions off", async () => {
			api = await mount({ mode, runtime, permissions: {} });
			// Nothing is searched when data crosses, so data carrying nothing of a module's is viewed like any other.
			expect(await api.owner.givePlain()).toEqual({ proxy: true, frozen: false, box: true, inner: true });
			await api.shutdown();
			const plain = { proxy: false, frozen: false, box: false, inner: false };
			api = await mount({ mode, runtime });
			expect(await api.owner.givePlain()).toEqual(plain);
			expect(await api.owner.giveNested()).toEqual(plain);
			expect(await api.owner.giveFrozen()).toEqual({ ...plain, frozen: true });
		});

		it("answers true for the prototype an emitter reports to a module denied it, false for the object itself", async () => {
			api = await mount({ mode, runtime, permissions: DENY_READER });
			expect(await api.reader.checkEmitterPrototype()).toEqual({ proxy: true, wrapped: true });
			await api.shutdown();
			api = await mount({ mode, runtime });
			expect(await api.reader.checkEmitterPrototype()).toEqual({ proxy: false, wrapped: false });
		});

		it("answers true for a callable node's own valueOf, which is no Proxy", async () => {
			api = await mount({ mode, runtime });
			const valueOf = api.owner.fn.valueOf;
			expect(types.isProxy(valueOf)).toBe(false);
			expect(valueOf.call(api.owner.fn)).toBe(api.owner.fn);
			expect(api.slothlet.wrapped(valueOf)).toBe(true);
			expect(api.slothlet.wrapped(Object.prototype.valueOf)).toBe(false);
		});
	}
);
