/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hook-id-after-reload.test.vitest.mjs
 *	@Date: 2026-11-22T23:21:25-08:00 (1795418485)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T23:41:25-08:00 (1795419685)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A hook registered after a reload, or while one is running, gets an id no hook carried over holds.
 *
 * @description
 * A reload carries every hook into the new hook manager under the id it had. A hook registered afterwards with no id
 * of its own is given a fresh one: never an id a carried hook already holds, which would refuse the registration with
 * `HOOK_ID_IN_USE`. So the host registers hooks after a reload as before it, and a module's registration in a reload
 * window is decided by its rules as at any other time (`PERMISSION_DENIED` for one a rule refuses), registering nothing.
 *
 * Fixtures (written to tmp/): `base/root.mjs` (the hooked function) and `guest/probe.mjs` (registers a hook on it).
 * @module tests/vitests/suites/hooks/hook-id-after-reload
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(process.cwd(), "tmp", "hook-id-after-reload");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "base"), { recursive: true });
	mkdirSync(path.join(ROOT, "guest"), { recursive: true });
	writeFileSync(path.join(ROOT, "base", "root.mjs"), 'export function ping() {\n\treturn "pong";\n}\n');
	writeFileSync(
		path.join(ROOT, "guest", "probe.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export function hookNow() {",
			"\ttry {",
			'\t\tself.slothlet.hook.on("root.ping:after", () => "HOOKED");',
			'\t\treturn "done";',
			"\t} catch (error) {",
			"\t\treturn error.code;",
			"\t}",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe.each(getMatrixConfigs())("a hook id after a reload > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("the host registers a hook after a reload, under an id of its own", async () => {
		api = await slothlet({ ...config, base: path.join(ROOT, "base"), silent: true, hook: { enabled: true } });
		const first = api.slothlet.hook.on("root.ping:before", () => {});
		await api.slothlet.reload();
		let second;
		expect(() => (second = api.slothlet.hook.on("root.ping:before", () => {}))).not.toThrow();
		expect(second).not.toBe(first);
		const ids = api.slothlet.hook.list().registeredHooks.map((hook) => hook.id);
		expect(ids).toContain(first);
		expect(ids).toContain(second);
	});

	it("a module's registration a rule refuses, made while a reload runs, is refused by the rule", async () => {
		api = await slothlet({
			...config,
			base: path.join(ROOT, "base"),
			silent: true,
			hook: { enabled: true },
			permissions: { policy: "allow", rules: [{ caller: "guest.**", target: "root.ping:hook", effect: "deny" }] }
		});
		await api.slothlet.api.add("guest", path.join(ROOT, "guest"), { id: "guest" });
		api.slothlet.hook.on("root.ping:before", () => {});
		await api.slothlet.reload();
		expect(await api.guest.probe.hookNow()).toBe("PERMISSION_DENIED");
		const reloading = api.slothlet.reload();
		const during = await api.guest.probe.hookNow();
		await reloading;
		expect(during).toBe("PERMISSION_DENIED");
		expect(api.slothlet.hook.list().registeredHooks).toHaveLength(1);
	});
});
