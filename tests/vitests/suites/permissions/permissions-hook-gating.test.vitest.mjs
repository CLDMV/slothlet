/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-hook-gating.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Hook ↔ permission integration (#118). A hook is gated by the same permission
 * system as calls, keyed on the hook owner (the module that registered it) and the suffix target
 * `pattern:type` (`:hook` = any type). Registration of a concrete-target hook is checked up front;
 * glob-target hooks register and are filtered per concrete path at fire time. With no matching hook
 * rule the decision falls back to whether the owner may CALL the path (blocked path ⇒ blocked hook).
 * The hook-management surface has a built-in baseline (deny `slothlet.hook.**`, allow `list`/`on`),
 * and an unpinned module hook is force-pinned unless `hook.allowUnpinned` (host-only) is set.
 *
 * The fixture's `auditor` module registers hooks from within itself (via `self.slothlet.hook.on`)
 * so its calls carry a real owner identity (`auditor.<fn>`).
 *
 * @module tests/vitests/suites/permissions/permissions-hook-gating
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const DIR = join(process.cwd(), "tmp", "hook-gating-fixture");

beforeAll(() => {
	mkdirSync(join(DIR, "db"), { recursive: true });
	writeFileSync(join(DIR, "db", "write.mjs"), `export function write(x) { return "wrote:" + x; }\n`);
	writeFileSync(join(DIR, "db", "read.mjs"), `export function read() { return "data"; }\n`);
	writeFileSync(
		join(DIR, "auditor.mjs"),
		`import { self } from "@cldmv/slothlet/runtime";
export function arm(typePattern, sink) { return self.slothlet.hook.on(typePattern, (ctx) => { if (sink) sink.push(ctx.path); }); }
export function armOpts(typePattern, options) { return self.slothlet.hook.on(typePattern, () => {}, options); }
export function callDisable() { return self.slothlet.hook.disable(); }
export function callList() { return self.slothlet.hook.list(); }
export function callPinDisable() { return self.slothlet.hook.pin.disable(); }
`
	);
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe.each(getMatrixConfigs())("Permissions > hook gating (#118) > $name", ({ config }) => {
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
	// Takes a thunk so the call happens INSIDE try — a synchronous throw (lazy/live modes) is caught
	// the same as a promise rejection (async modes).
	const tryCall = async (fn) => {
		try {
			return { ok: true, value: await fn() };
		} catch (e) {
			return { ok: false, code: e.code, message: e.message };
		}
	};

	it("denies a module registering a concrete-target hook on a denied path", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [] });
		const r = await tryCall(() => api.auditor.arm("db.write:before"));
		expect(r.ok).toBe(false);
		expect(r.code).toBe("PERMISSION_DENIED");
	});

	it("allows + fires a concrete-target hook with a matching hook rule", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [{ caller: "auditor.**", target: "db.read:before", effect: "allow" }] });
		const sink = [];
		const r = await tryCall(() => api.auditor.arm("db.read:before", sink));
		expect(r.ok).toBe(true);
		await api.db.read();
		expect(sink).toEqual(["db.read"]);
	});

	it("fire-time gating: a glob hook fires only on paths the owner may hook (layered fallback)", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [{ caller: "auditor.**", target: "db.read:before", effect: "allow" }] });
		const sink = [];
		await api.auditor.arm("db.*:before", sink); // glob → registers; gated per concrete path at fire time
		await api.db.write(1);
		await api.db.read();
		expect(sink).toEqual(["db.read"]); // db.write denied via fallback to the call decision
	});

	it("`:hook` grants every hook type on the path", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [{ caller: "auditor.**", target: "db.read:hook", effect: "allow" }] });
		expect((await tryCall(() => api.auditor.arm("db.read:before"))).ok).toBe(true);
		expect((await tryCall(() => api.auditor.arm("db.read:after"))).ok).toBe(true);
		expect((await tryCall(() => api.auditor.arm("db.read:error"))).ok).toBe(true);
	});

	it("a hook-only deny blocks hooking a path that is still callable", async () => {
		api = await boot({ defaultPolicy: "allow", rules: [{ caller: "auditor.**", target: "db.read:before", effect: "deny" }] });
		const r = await tryCall(() => api.auditor.arm("db.read:before"));
		expect(r.ok).toBe(false);
		expect(r.code).toBe("PERMISSION_DENIED");
		expect(await api.db.read()).toBe("data"); // calling the path still works
	});

	it("management baseline: hook.disable is denied, hook.list is allowed", async () => {
		api = await boot({ defaultPolicy: "allow", rules: [] });
		const dis = await tryCall(() => api.auditor.callDisable());
		expect(dis.ok).toBe(false);
		expect(dis.code).toBe("PERMISSION_DENIED");
		expect((await tryCall(() => api.auditor.callList())).ok).toBe(true);
	});

	it("force-pins a module hook registered with lockCaller:false (pin enforced) and warns", async () => {
		api = await boot(null); // force-pin is independent of the permission system
		const id = await api.auditor.armOpts("db.read:before", { lockCaller: false });
		const { registeredHooks } = api.slothlet.hook.list({ id });
		expect(registeredHooks[0].lockCaller).toBe(true); // forced back on
		expect(SlothletWarning.captured.some((w) => w.code === "HOOK_UNPINNED_IGNORED")).toBe(true);
	});

	it("the pin runtime switch is host-only when permissions are enabled", async () => {
		api = await boot({ defaultPolicy: "allow", rules: [] });
		const mod = await tryCall(() => api.auditor.callPinDisable());
		expect(mod.ok).toBe(false);
		expect(mod.code).toBe("PERMISSION_DENIED");
		expect(api.slothlet.hook.pin.enabled).toBe(true); // host read: still enforced
		api.slothlet.hook.pin.disable(); // host: allowed
		expect(api.slothlet.hook.pin.enabled).toBe(false);
		api.slothlet.hook.pin.enable(); // host: re-enable enforcement
		expect(api.slothlet.hook.pin.enabled).toBe(true);
	});

	it("host pin.disable() lets a module register an unpinned hook (no force-pin, no warn)", async () => {
		api = await boot(null);
		api.slothlet.hook.pin.disable();
		SlothletWarning.clearCaptured();
		const id = await api.auditor.armOpts("db.read:before", { lockCaller: false });
		const { registeredHooks } = api.slothlet.hook.list({ id });
		expect(registeredHooks[0].lockCaller).toBe(false); // honored, not forced
		expect(SlothletWarning.captured.some((w) => w.code === "HOOK_UNPINNED_IGNORED")).toBe(false);
	});

	it("host-registered hooks fire regardless of permissions (no owner identity to gate)", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [] });
		const sink = [];
		api.slothlet.hook.on("db.read:before", (ctx) => sink.push(ctx.path)); // host caller → ownerPath null
		await api.db.read();
		expect(sink).toEqual(["db.read"]); // trusted host hook fires even under default-deny
	});

	it("colon-but-non-hook-type and empty-path targets are treated as plain call rules", async () => {
		api = await boot({
			defaultPolicy: "allow",
			rules: [
				{ caller: "**", target: "db.read:xyz", effect: "deny" }, // 'xyz' is not a hook type → call rule
				{ caller: "**", target: ":before", effect: "deny" } // empty path before the type → call rule
			]
		});
		// Both are inert call rules (no real path equals them), so hooking db.read still works.
		const sink = [];
		await api.auditor.arm("db.read:before", sink);
		await api.db.read();
		expect(sink).toEqual(["db.read"]);
	});

	it("a more specific hook rule overrides a broader one", async () => {
		api = await boot({
			defaultPolicy: "deny",
			rules: [
				{ caller: "auditor.**", target: "db.**:hook", effect: "allow" }, // broad: any hook on db.**
				{ caller: "auditor.**", target: "db.write:before", effect: "deny" } // specific: deny before-hook on db.write
			]
		});
		expect((await tryCall(() => api.auditor.arm("db.read:before"))).ok).toBe(true); // broad allow
		const w = await tryCall(() => api.auditor.arm("db.write:before"));
		expect(w.ok).toBe(false); // specific deny wins
		expect(w.code).toBe("PERMISSION_DENIED");
	});

	it("hook: { pin: false } config permits unpinned module hooks", async () => {
		api = await slothlet({ ...config, base: DIR, hook: { enabled: true, pin: false } });
		SlothletWarning.clearCaptured();
		const id = await api.auditor.armOpts("db.read:before", { lockCaller: false });
		const { registeredHooks } = api.slothlet.hook.list({ id });
		expect(registeredHooks[0].lockCaller).toBe(false); // config disabled pin enforcement
		expect(SlothletWarning.captured.some((w) => w.code === "HOOK_UNPINNED_IGNORED")).toBe(false);
	});

	it("force-pin under silent ignores lockCaller:false without warning", async () => {
		api = await slothlet({ ...config, base: DIR, hook: true, silent: true });
		SlothletWarning.clearCaptured();
		const id = await api.auditor.armOpts("db.read:before", { lockCaller: false });
		const { registeredHooks } = api.slothlet.hook.list({ id });
		expect(registeredHooks[0].lockCaller).toBe(true); // still force-pinned
		expect(SlothletWarning.captured.some((w) => w.code === "HOOK_UNPINNED_IGNORED")).toBe(false); // silent suppresses the warn
	});

	it("a before-only hook rule denies an after-hook on the same path (per-type)", async () => {
		api = await boot({ defaultPolicy: "deny", rules: [{ caller: "auditor.**", target: "db.read:before", effect: "allow" }] });
		expect((await tryCall(() => api.auditor.arm("db.read:before"))).ok).toBe(true); // before allowed
		const after = await tryCall(() => api.auditor.arm("db.read:after"));
		expect(after.ok).toBe(false); // after not covered → falls back to the (denied) call decision
		expect(after.code).toBe("PERMISSION_DENIED");
	});

	it("equal-specificity hook rules: the last-registered wins", async () => {
		api = await boot({
			defaultPolicy: "deny",
			rules: [
				{ caller: "auditor.**", target: "db.read:before", effect: "allow" },
				{ caller: "auditor.**", target: "db.read:before", effect: "deny" } // identical target/spec, later → wins
			]
		});
		const r = await tryCall(() => api.auditor.arm("db.read:before"));
		expect(r.ok).toBe(false); // last-registered deny wins the tiebreak
		expect(r.code).toBe("PERMISSION_DENIED");
	});
});
