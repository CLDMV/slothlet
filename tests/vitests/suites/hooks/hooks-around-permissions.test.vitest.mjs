/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-around-permissions.test.vitest.mjs
 *	@Date: 2026-09-28T12:00:00-07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:06-07:00 (1791090906)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Permissions and pinning for `around` hooks (#496).
 *
 * @description
 * An around hook can replace args and results and prevent the call entirely, so it is gated exactly
 * like a transforming (`before`) hook: rule targets use the `pattern:around` suffix (`:hook` covers
 * it), concrete registrations are checked up front, glob registrations are filtered per concrete
 * path at fire time, and module-registered hooks are force-pinned to their owner.
 *
 * Pinning runs the around handler as its owner — but the rest of the pipeline its `next()` runs
 * belongs to the intercepted call, so the target still sees that call's own caller.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const DIR = join(process.cwd(), "tmp", "hook-around-permissions-fixture");

beforeAll(() => {
	mkdirSync(join(DIR, "db"), { recursive: true });
	writeFileSync(join(DIR, "db", "read.mjs"), `export function read() { return "data"; }\n`);
	writeFileSync(join(DIR, "db", "write.mjs"), `export function write(x) { return "wrote:" + x; }\n`);
	writeFileSync(
		join(DIR, "db", "who.mjs"),
		`import { self } from "@cldmv/slothlet/runtime";
export function who() { return self.slothlet.metadata.caller()?.apiPath ?? null; }
`
	);
	writeFileSync(
		join(DIR, "client.mjs"),
		`import { self } from "@cldmv/slothlet/runtime";
export function callWho() { return self.db.who(); }
`
	);
	writeFileSync(
		join(DIR, "auditor.mjs"),
		`import { self } from "@cldmv/slothlet/runtime";
export function arm(typePattern, sink) {
	return self.slothlet.hook.on(typePattern, (ctx) => {
		if (sink) sink.push({ path: ctx.path, entry: ctx.entry, caller: ctx.caller ? ctx.caller.apiPath : null });
		return typeof ctx.next === "function" ? ctx.next() : undefined;
	});
}
export function armOpts(typePattern, options) { return self.slothlet.hook.on(typePattern, ({ next }) => next(), options); }
`
	);
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe.each(getMatrixConfigs())("Hooks > around permissions and pinning (#496) > $name", ({ config }) => {
	let api;

	beforeEach(() => {
		SlothletWarning.suppressConsole = true;
		SlothletWarning.clearCaptured();
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		SlothletWarning.clearCaptured();
	});

	const boot = (permissions) => slothlet({ ...config, base: DIR, hook: true, ...(permissions ? { permissions } : {}) });
	// Takes a thunk so the call happens INSIDE try — a synchronous throw is caught the same as a rejection.
	const tryCall = async (fn) => {
		try {
			return { ok: true, value: await fn() };
		} catch (e) {
			return { ok: false, code: e.code };
		}
	};

	it("denies a module registering a concrete-target around hook on a denied path", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [] });
		const r = await tryCall(() => api.auditor.arm("db.write:around"));
		expect(r.ok).toBe(false);
		expect(r.code).toBe("PERMISSION_DENIED");
	});

	it("allows and fires an around hook with a matching `:around` rule", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [{ caller: "auditor.**", target: "db.read:around", effect: "allow" }] });
		const sink = [];
		expect((await tryCall(() => api.auditor.arm("db.read:around", sink))).ok).toBe(true);
		expect(await api.db.read()).toBe("data");
		expect(sink).toEqual([{ path: "db.read", entry: true, caller: null }]);
	});

	it("an `:around` rule grants only around — a before hook on the same path stays denied", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [{ caller: "auditor.**", target: "db.read:around", effect: "allow" }] });
		expect((await tryCall(() => api.auditor.arm("db.read:before"))).code).toBe("PERMISSION_DENIED");
	});

	it("`:hook` grants around hooks too", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [{ caller: "auditor.**", target: "db.read:hook", effect: "allow" }] });
		expect((await tryCall(() => api.auditor.arm("db.read:around"))).ok).toBe(true);
	});

	it("an around-only deny blocks the hook while the path stays callable", async () => {
		api = await boot({ defaultPolicy: "allow", rules: [{ caller: "auditor.**", target: "db.read:around", effect: "deny" }] });
		expect((await tryCall(() => api.auditor.arm("db.read:around"))).code).toBe("PERMISSION_DENIED");
		expect(await api.db.read()).toBe("data");
	});

	it("fire-time gating: a glob around hook fires only on paths its owner may hook", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [{ caller: "auditor.**", target: "db.read:around", effect: "allow" }] });
		const sink = [];
		await api.auditor.arm("db.*:around", sink);
		expect(await api.db.write(1)).toBe("wrote:1");
		expect(await api.db.read()).toBe("data");
		expect(sink.map((entry) => entry.path)).toEqual(["db.read"]);
	});

	it("force-pins a module around hook registered with lockCaller:false and warns", async () => {
		api = await boot(null);
		const id = await api.auditor.armOpts("db.read:around", { lockCaller: false });
		expect(api.slothlet.hook.list({ id }).registeredHooks[0].lockCaller).toBe(true);
		expect(SlothletWarning.captured.some((w) => w.code === "HOOK_UNPINNED_IGNORED")).toBe(true);
	});

	it("a pinned around hook's next() runs the target as the intercepted call, not as the hook owner", async () => {
		api = await boot(null);
		const sink = [];
		await api.auditor.arm("db.who:around", sink);

		// Entry call: no module caller — the hook owner must not leak in as the target's caller.
		expect(await api.db.who()).toBeNull();
		// Nested call: the target sees the module that actually called it.
		expect(await api.client.callWho()).toBe("client.callWho");
		expect(sink).toEqual([
			{ path: "db.who", entry: true, caller: null },
			{ path: "db.who", entry: false, caller: "client.callWho" }
		]);
	});
});
