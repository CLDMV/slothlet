/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-hook-self-bypass.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Same-file self-bypass for hooks (#995). A module hooking an exact path whose leaf slothlet
 * recorded in the module's own source file is allowed, as a call to that leaf is, at registration and when
 * the hook fires. A pattern hook goes through the rules for every concrete path, its owner's own file
 * included. The target file is the one recorded for the path's current owner, so it follows remove and
 * re-add.
 *
 * Fixture: `own/tool.mjs` registers hooks from inside itself (`arm`) and exports `work`, so
 * `own.tool.work` is in the registering module's file and `own.other.work` is not.
 *
 * @module tests/vitests/suites/permissions/permissions-hook-self-bypass
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const ROOT = join(process.cwd(), "tmp", "hook-self-bypass-fixture");
const DIR = join(ROOT, "base");
const ALT = join(ROOT, "alt");

beforeAll(() => {
	mkdirSync(join(DIR, "own"), { recursive: true });
	mkdirSync(join(ALT, "tool"), { recursive: true });
	writeFileSync(
		join(DIR, "own", "tool.mjs"),
		`import { self } from "@cldmv/slothlet/runtime";
export function arm(typePattern, sink) { return self.slothlet.hook.on(typePattern, (ctx) => { if (sink) sink.push(ctx.path); }); }
export function work() { return "tool"; }
export function _secret() { return "secret"; }
export function useSecret() { return self.own.tool._secret(); }
`
	);
	writeFileSync(join(DIR, "own", "other.mjs"), `export function work() { return "other"; }\nexport function ping() { return "pong"; }\n`);
	writeFileSync(join(ALT, "tool", "tool.mjs"), `export function work() { return "alt"; }\nexport function spare() { return "spare"; }\n`);
});

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

const MODES = ["on", "strict"];
const CONFIGS = getMatrixConfigs({ hook: { enabled: true } }).flatMap(({ name, config }) =>
	MODES.map((mode) => ({ name: `${name} permissions:${mode}`, config, mode }))
);

describe.each(CONFIGS)("Permissions > hook self-bypass (#995) > $name", ({ config, mode }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const boot = (rules = []) => slothlet({ ...config, base: DIR, hook: true, permissions: { mode, policy: "deny", rules } });
	// Takes a thunk so a synchronous throw is caught like a rejection.
	const tryCall = async (fn) => {
		try {
			return { ok: true, value: await fn() };
		} catch (e) {
			return { ok: false, code: e.code };
		}
	};

	it("allows a module to hook an exact path in its own file, and the hook fires", async () => {
		api = await boot();
		const sink = [];
		const r = await tryCall(() => api.own.tool.arm("own.tool.work:before", sink));
		expect(r.ok).toBe(true);
		expect(await api.own.tool.work()).toBe("tool");
		expect(sink).toEqual(["own.tool.work"]);
	});

	it("bypasses a hook rule that denies the own path, as a call's self-bypass bypasses every rule", async () => {
		api = await boot([{ caller: "own.**", target: "own.tool.work:before", effect: "deny" }]);
		const sink = [];
		expect((await tryCall(() => api.own.tool.arm("own.tool.work:before", sink))).ok).toBe(true);
		await api.own.tool.work();
		expect(sink).toEqual(["own.tool.work"]);
	});

	it("still denies an exact path in another file", async () => {
		api = await boot();
		const r = await tryCall(() => api.own.tool.arm("own.other.work:before"));
		expect(r.ok).toBe(false);
		expect(r.code).toBe("PERMISSION_DENIED");
	});

	it("puts a pattern covering the own file through the rules, with no file bypass", async () => {
		api = await boot();
		const sink = [];
		expect((await tryCall(() => api.own.tool.arm("own.tool.*:before", sink))).ok).toBe(true);
		await api.own.tool.work();
		expect(sink).toEqual([]);
	});

	it("fires a pattern hook on the own file only where a rule allows it", async () => {
		api = await boot([{ caller: "own.**", target: "own.tool.work:before", effect: "allow" }]);
		const sink = [];
		await api.own.tool.arm("own.*.work:before", sink);
		await api.own.tool.work();
		await api.own.other.work();
		expect(sink).toEqual(["own.tool.work"]);
	});

	it("emits permission:self-bypass when the hook is registered", async () => {
		api = await boot();
		const events = [];
		api.slothlet.lifecycle.on("permission:self-bypass", (data) => events.push(data));
		await api.own.tool.arm("own.tool.work:before");
		const hookEvents = events.filter((e) => Array.isArray(e.target) && e.target.join(".") === "own.tool.work:before");
		expect(hookEvents).toHaveLength(1);
		expect(hookEvents[0].file).toMatch(/own[\\/]tool\.mjs$/);
	});

	it("emits no permission:self-bypass for a pattern hook", async () => {
		api = await boot();
		const events = [];
		api.slothlet.lifecycle.on("permission:self-bypass", (data) => events.push(data));
		await api.own.tool.arm("own.tool.*:before");
		await api.own.tool.work();
		expect(
			events.filter((e) => Array.isArray(e.target) && e.target.join(".").startsWith("own.tool.") && e.target.join(".").includes(":"))
		).toEqual([]);
	});

	it("keeps an own-file hook firing after a reload", async () => {
		api = await boot();
		const sink = [];
		await api.own.tool.arm("own.tool.work:before", sink);
		await api.slothlet.reload();
		await api.own.tool.work();
		expect(sink).toEqual(["own.tool.work"]);
	});

	it("follows the path's current owner: a leaf re-added from another file loses the bypass", async () => {
		api = await boot();
		// The same files mounted a second time: `ext.tool.work` is recorded in own/tool.mjs.
		await api.slothlet.api.add("ext", join(DIR, "own"));
		const sink = [];
		expect((await tryCall(() => api.own.tool.arm("ext.tool.work:before", sink))).ok).toBe(true);
		await api.ext.tool.work();
		expect(sink).toEqual(["ext.tool.work"]);

		// Re-added from a different file: the hook no longer fires there.
		await api.slothlet.api.remove("ext");
		await api.slothlet.api.add("ext", ALT);
		expect(await api.ext.tool.work()).toBe("alt");
		expect(sink).toEqual(["ext.tool.work"]);
	});

	it("lets a module hook a private member of its own file", async () => {
		api = await boot();
		const sink = [];
		expect((await tryCall(() => api.own.tool.arm("own.tool._secret:before", sink))).ok).toBe(true);
		expect(await api.own.tool.useSecret()).toBe("secret");
		expect(sink).toEqual(["own.tool._secret"]);
	});

	it("decides module privacy before the bypass: the same file mounted by another module keeps its private member", async () => {
		api = await boot();
		await api.slothlet.api.add("ext", join(DIR, "own"));
		const r = await tryCall(() => api.own.tool.arm("ext.tool._secret:before"));
		expect(r.ok).toBe(false);
		expect(r.code).toBe("PERMISSION_DENIED");
		// A public member of the same file is not private, so the bypass applies there.
		expect((await tryCall(() => api.own.tool.arm("ext.tool.work:before"))).ok).toBe(true);
	});

	it("does not bypass a path whose leaf is in another file, before or after it loads", async () => {
		api = await boot();
		// Under lazy, own.other has not been loaded yet here.
		const before = await tryCall(() => api.own.tool.arm("own.other.work:before"));
		expect(before.ok).toBe(false);
		expect(before.code).toBe("PERMISSION_DENIED");
		expect(await api.own.other.work()).toBe("other");
		const after = await tryCall(() => api.own.tool.arm("own.other.work:before"));
		expect(after.ok).toBe(false);
		expect(after.code).toBe("PERMISSION_DENIED");
	});
});
