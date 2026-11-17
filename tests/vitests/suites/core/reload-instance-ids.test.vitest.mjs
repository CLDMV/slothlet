/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/reload-instance-ids.test.vitest.mjs
 *	@Date: 2026-11-17T13:19:47-08:00 (1794950387)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:27:37-08:00 (1794950857)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Instance IDs a reload or restart takes cannot be claimed ahead of it.
 *
 * @description
 * The process-wide object the copies of slothlet share (`globalThis[Symbol.for("@cldmv/slothlet.instanceImports")]`)
 * claims instance IDs, and a module's code can reach it and read its instance's ID. A reload's ID used to be the old
 * ID and the time, so a module could claim the next seconds' worth of them and leave the instance unable to reload,
 * restart or answer a call. Now the shared `claim` answers only slothlet's own code, reload and restart IDs carry a
 * random part, and a reload claims its new ID before it lets go of the old one: when no ID can be claimed the reload
 * fails and the instance stays on the ID it holds, still working.
 */

import path from "node:path";
import { describe, it, expect, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { claimInstanceScope } from "#helpers/instance-imports";
import { Utilities } from "#helpers/utilities";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_reload_id_squatter");

const CONFIGS = [
	{ name: "eager/async", mode: "eager", runtime: "async" },
	{ name: "eager/live", mode: "eager", runtime: "live" },
	{ name: "lazy/async", mode: "lazy", runtime: "async" },
	{ name: "lazy/live", mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("reload and restart instance IDs > $name", ({ mode, runtime }) => {
	let api;
	const held = [];

	afterEach(async () => {
		vi.restoreAllMocks();
		for (const handle of held.splice(0)) handle.release();
		await api?.shutdown().catch(() => {});
		api = undefined;
	});

	const build = () => slothlet({ base: BASE, mode, runtime, silent: true, api: { mutations: { reload: true } } });

	it("refuses a module's claims on the shared object", async () => {
		api = await build();
		expect(await api.squatter.claimAhead(50)).toBe(0);
	});

	it("reloads, reloads keeping the ID, and restarts after a module tried to claim the IDs ahead", async () => {
		api = await build();
		const first = api.slothlet.instance.id;
		await api.squatter.claimAhead(5000);

		await api.slothlet.reload();
		const reloaded = api.slothlet.instance.id;
		expect(reloaded.startsWith(`${first}_reload_`)).toBe(true);
		expect((await api.squatter.ping()).id).toBe(reloaded);

		await api.squatter.claimAhead(5000);
		await api.slothlet.reload({ instance: "keep" });
		expect(api.slothlet.instance.id).toBe(reloaded);
		expect((await api.squatter.ping()).id).toBe(reloaded);

		await api.squatter.claimAhead(5000);
		await api.slothlet.restart();
		expect(api.slothlet.instance.id).not.toBe(reloaded);
		expect((await api.squatter.ping()).id).toBe(api.slothlet.instance.id);
	});

	it("gives each reload an ID with a random part, not just the time", async () => {
		api = await build();
		vi.spyOn(Date, "now").mockReturnValue(1790000000000);
		const first = api.slothlet.instance.id;
		await api.slothlet.reload();
		const one = api.slothlet.instance.id;
		expect(one).toMatch(new RegExp(`^${first}_reload_\\d+_[a-z0-9]+$`));
		expect(one).not.toBe(`${first}_reload_1790000000000`);
	});

	it("passes over an ID something else holds, and takes the next fresh one", async () => {
		api = await build();
		const first = api.slothlet.instance.id;
		let n = 0;
		vi.spyOn(Utilities.prototype, "generateId").mockImplementation((prefix = "slothlet") => `${prefix}_fixed_${n++}`);
		for (let k = 0; k < 3; k++) held.push(claimInstanceScope(`${first}_reload_fixed_${k}`));
		expect(held.every(Boolean)).toBe(true);
		await api.slothlet.reload();
		expect(api.slothlet.instance.id).toBe(`${first}_reload_fixed_3`);
		expect((await api.squatter.ping()).id).toBe(`${first}_reload_fixed_3`);
	});

	it("rolls back when no fresh ID can be claimed: the instance stays on its ID and keeps working", async () => {
		api = await build();
		const first = api.slothlet.instance.id;
		const before = await api.squatter.ping();
		vi.spyOn(Utilities.prototype, "generateId").mockImplementation((prefix = "slothlet") => `${prefix}_fixed`);
		held.push(claimInstanceScope(`${first}_reload_fixed`));
		expect(held[0]).not.toBe(null);

		await expect(api.slothlet.reload()).rejects.toMatchObject({ code: "INSTANCE_ID_IN_USE" });
		expect(api.slothlet.instance.id).toBe(first);
		// Same module copy, still answering under the ID it had.
		expect(await api.squatter.ping()).toEqual({ id: first, calls: before.calls + 1 });
		await api.slothlet.reload({ instance: "keep" });
		expect(api.slothlet.instance.id).toBe(first);

		// Once the ID is free again, the reload goes through.
		held.splice(0).forEach((handle) => handle.release());
		await api.slothlet.reload();
		expect(api.slothlet.instance.id).toBe(`${first}_reload_fixed`);
		expect((await api.squatter.ping()).id).toBe(`${first}_reload_fixed`);
	});
});
