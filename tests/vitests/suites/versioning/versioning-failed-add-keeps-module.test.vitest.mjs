/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-failed-add-keeps-module.test.vitest.mjs
 *	@Date: 2026-11-25T08:35:48-08:00 (1795624548)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T09:10:30-08:00 (1795626630)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A versioned add that fails leaves the instance as it was (#986).
 *
 * @description
 * A versioned add whose tag is already registered at the path fails with VERSION_REGISTER_DUPLICATE. It used to mount
 * first and then roll back by module id, so an add reusing the registered module's id removed that module too, and with
 * `replay: false` it also dropped that module's history entry, so a full reload did not bring it back. An add that loses
 * a race to the same tag still fails at registration; its rollback removes only what it recorded itself.
 *
 * @module tests/vitests/suites/versioning/versioning-failed-add-keeps-module
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Versioning > failed add keeps the mounted module (#986) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const make = () => slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true, api: { collision: { override: true } } });

	it.each([true, false])(
		"a duplicate tag under the same id (replay: %s) keeps the first module, before and after reload",
		async (replay) => {
			api = await make();
			await api.slothlet.api.add("auth", { login: () => "first" }, { id: "m1", version: { tag: "v1" } });
			await expect(
				api.slothlet.api.add("auth", { login: () => "second" }, { id: "m1", version: { tag: "v1" }, replay })
			).rejects.toMatchObject({
				code: "VERSION_REGISTER_DUPLICATE"
			});
			expect(await api.v1.auth.login()).toBe("first");
			expect(await api.auth.login()).toBe("first");
			await api.slothlet.reload();
			expect(await api.v1.auth.login()).toBe("first");
			expect(await api.auth.login()).toBe("first");
		}
	);

	it("a duplicate tag under another id keeps the first module", async () => {
		api = await make();
		await api.slothlet.api.add("auth", { login: () => "first" }, { id: "m1", version: { tag: "v1" } });
		await expect(api.slothlet.api.add("auth", { login: () => "second" }, { id: "m2", version: { tag: "v1" } })).rejects.toMatchObject({
			code: "VERSION_REGISTER_DUPLICATE"
		});
		await api.slothlet.reload();
		expect(await api.auth.login()).toBe("first");
	});

	it.each([true, false])("two adds racing for one tag (replay: %s): one wins, and the loser is not replayed", async (replay) => {
		api = await make();
		await api.slothlet.api.add("other", { ping: () => "pong" }, { id: "keep" });
		const results = await Promise.allSettled([
			api.slothlet.api.add("auth", { login: () => "a" }, { id: "a", version: { tag: "v1" }, replay }),
			api.slothlet.api.add("auth", { login: () => "b" }, { id: "b", version: { tag: "v1" }, replay })
		]);
		const rejected = results.filter((r) => r.status === "rejected");
		expect(rejected).toHaveLength(1);
		expect(rejected[0].reason).toMatchObject({ code: "VERSION_REGISTER_DUPLICATE" });
		const winner = results[0].status === "fulfilled" ? "a" : "b";
		expect(await api.v1.auth.login()).toBe(winner);
		await api.slothlet.reload();
		expect(await api.other.ping()).toBe("pong");
		if (replay) expect(await api.v1.auth.login()).toBe(winner);
		else expect(api.v1?.auth).toBeUndefined();
	});
});
