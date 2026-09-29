/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-owner.test.vitest.mjs
 *	@Date: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `permissions.owner` (#509): a module may reach every leaf it owns.
 *
 * @description
 * A subdirectory is its own permission module, so under `defaultPolicy: "deny"` a module added with
 * one `api.add(path, folder, { moduleID })` cannot call its own leaves across directories. With
 * `permissions.owner: true`, a caller leaf owned by module M may access any target leaf whose CURRENT
 * owner is M — matched by owner, never by path, so a second module mounted into the same namespace
 * gets nothing. The grant is an implicit allow in place of the default policy: an explicit deny rule
 * still wins, and under `defaultPolicy: "allow"` nothing changes.
 *
 * Fixture (`api_tests/api_test_permissions_owner`):
 * - `base/core/alpha.mjs` → `core.alpha.*`, calls `core.sub.beta.ping` (base-loaded, own subdirectory)
 * - `ext/main.mjs` → `launcher.main.*` (added as moduleID "ext" at "launcher")
 * - `ext/session/store.mjs` → `launcher.session.store.{create,destroy}`
 * - `ext/settings/data.mjs` → `launcher.settings.data.limit` (data leaf)
 * - `other/intruder.mjs` → `launcher.intruder.*` (moduleID "other", same mount)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "../../../../api_tests/api_test_permissions_owner");
const BASE = `${FIXTURE}/base`;
const EXT = `${FIXTURE}/ext`;
const OTHER = `${FIXTURE}/other`;

/**
 * Run `fn` and report its settled outcome: the resolved value, or the error code it rejected with.
 * @param {function(): *} fn - Call to make.
 * @returns {Promise<{ ok: boolean, value?: *, code?: string }>} Outcome.
 */
async function outcome(fn) {
	try {
		return { ok: true, value: await fn() };
	} catch (err) {
		return { ok: false, code: err?.code };
	}
}

describe.each(getMatrixConfigs())("Permissions > owner grant (#509) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build an instance over the base fixture and mount the extension (+ optionally the co-mounted module).
	 * @param {object} permissions - `permissions` config block.
	 * @param {{ other?: boolean }} [opts] - Whether to mount the second module into the same namespace.
	 * @returns {Promise<object>} The api.
	 */
	async function build(permissions, { other = false } = {}) {
		api = await slothlet({ ...config, base: BASE, permissions });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "ext" });
		if (other) await api.slothlet.api.add("launcher", OTHER, { moduleID: "other" });
		return api;
	}

	it("allows a module's cross-subdirectory call to its own leaf with owner: true", async () => {
		await build({ defaultPolicy: "deny", owner: true });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
	});

	it("denies the same cross-subdirectory call without the option", async () => {
		await build({ defaultPolicy: "deny" });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("denies it with owner: false (the default)", async () => {
		await build({ defaultPolicy: "deny", owner: false });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("read-gates a module's own data leaf in a subdirectory: allowed with owner, denied without", async () => {
		await build({ defaultPolicy: "deny", owner: true });
		expect(await outcome(() => api.launcher.main.limit())).toEqual({ ok: true, value: 5 });
		await api.shutdown();

		await build({ defaultPolicy: "deny" });
		expect(await outcome(() => api.launcher.main.limit())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("gives a second module mounted into the same namespace nothing", async () => {
		await build({ defaultPolicy: "deny", owner: true }, { other: true });
		// The extension still reaches its own leaves with the other module merged in beside them.
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		expect(await outcome(() => api.launcher.main.limit())).toEqual({ ok: true, value: 5 });
		// The co-mounted module shares the path, not the owner: calls and reads are both denied.
		expect(await outcome(() => api.launcher.intruder.poke())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		expect(await outcome(() => api.launcher.intruder.peek())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("an explicit deny rule on one of the module's own leaves still denies it", async () => {
		await build({
			defaultPolicy: "deny",
			owner: true,
			rules: [{ caller: "launcher.**", target: "launcher.session.store.destroy", effect: "deny" }]
		});
		expect(await outcome(() => api.launcher.main.teardown())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		// The rule is scoped to one leaf; the module's other own leaves stay reachable.
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
	});

	it("an explicit deny rule added at runtime overrides the grant too", async () => {
		await build({ defaultPolicy: "deny", owner: true });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		api.slothlet.permissions.addRule({ caller: "launcher.main.**", target: "launcher.session.**", effect: "deny" });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("grants base-loaded modules their own cross-directory calls, and nothing across owners", async () => {
		await build({ defaultPolicy: "deny", owner: true });
		// Everything the initial load composes is owned by the base module.
		expect(await outcome(() => api.core.alpha.callBeta())).toEqual({ ok: true, value: "pong" });
		// Base → added extension and extension → base cross owners: denied.
		expect(await outcome(() => api.core.alpha.reachExt())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		expect(await outcome(() => api.launcher.main.reachBase())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("denies base-loaded cross-directory calls without the option", async () => {
		await build({ defaultPolicy: "deny" });
		expect(await outcome(() => api.core.alpha.callBeta())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("changes nothing under defaultPolicy: \"allow\"", async () => {
		for (const owner of [false, true]) {
			await build(
				{
					defaultPolicy: "allow",
					owner,
					rules: [{ caller: "launcher.**", target: "launcher.session.store.destroy", effect: "deny" }]
				},
				{ other: true }
			);
			expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
			expect(await outcome(() => api.launcher.intruder.poke())).toEqual({ ok: true, value: "created" });
			expect(await outcome(() => api.core.alpha.reachExt())).toEqual({ ok: true, value: "created" });
			expect(await outcome(() => api.launcher.main.teardown())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
			await api.shutdown();
			api = null;
		}
	});

	it("keeps the grant correct after the co-mounted module is removed", async () => {
		await build({ defaultPolicy: "deny", owner: true }, { other: true });
		expect(await outcome(() => api.launcher.intruder.poke())).toEqual({ ok: false, code: "PERMISSION_DENIED" });

		await api.slothlet.api.remove("other");
		expect(api.launcher.intruder).toBeUndefined();
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		expect(await outcome(() => api.launcher.main.limit())).toEqual({ ok: true, value: 5 });
		expect(await outcome(() => api.core.alpha.reachExt())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("tracks the new owner after the module is removed and its folder re-added under another moduleID", async () => {
		await build({ defaultPolicy: "deny", owner: true }, { other: true });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });

		await api.slothlet.api.remove("ext");
		await api.slothlet.api.add("launcher", EXT, { moduleID: "ext2" });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		// The co-mounted module still owns none of it.
		expect(await outcome(() => api.launcher.intruder.poke())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("keeps the grant correct across a scoped reload", async () => {
		await build({ defaultPolicy: "deny", owner: true });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });

		await api.slothlet.api.reload("ext");
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		expect(await outcome(() => api.launcher.main.limit())).toEqual({ ok: true, value: 5 });
		expect(await outcome(() => api.launcher.main.reachBase())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		expect(await outcome(() => api.core.alpha.reachExt())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("keeps the grant correct across a full reload", async () => {
		await build({ defaultPolicy: "deny", owner: true }, { other: true });
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });

		const reloaded = await api.slothlet.reload();
		if (reloaded) api = reloaded;
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		expect(await outcome(() => api.core.alpha.callBeta())).toEqual({ ok: true, value: "pong" });
		expect(await outcome(() => api.launcher.intruder.poke())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		expect(await outcome(() => api.core.alpha.reachExt())).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});

	it("answers silent checkAccess queries by current owner, and never grants the framework surface", async () => {
		await build({ defaultPolicy: "deny", owner: true }, { other: true });
		// Ownership is recorded as leaves compose; under lazy mode that is on first use, so use them first.
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		expect(await outcome(() => api.core.alpha.callBeta())).toEqual({ ok: true, value: "pong" });
		const check = (caller, target) => api.slothlet.permissions.global.checkAccess(caller, target);
		expect(check("launcher.main.activate", "launcher.session.store.create")).toBe(true);
		expect(check("core.alpha.callBeta", "core.sub.beta.ping")).toBe(true);
		expect(check("launcher.intruder.poke", "launcher.session.store.create")).toBe(false);
		// A caller or a target nothing registered has no owner, so it is never granted.
		expect(check("no.such.caller", "launcher.session.store.create")).toBe(false);
		expect(check("launcher.main.activate", "launcher.no.such.target")).toBe(false);
		// The reserved roots belong to the base tree in the ownership registry but are framework surface.
		expect(check("core.alpha.callBeta", "slothlet.metadata.get")).toBe(false);
		expect(check("core.alpha.callBeta", "shutdown")).toBe(false);
	});

	it("emits permission:owner-allow for a granted access under audit: \"verbose\"", async () => {
		await build({ defaultPolicy: "deny", owner: true, audit: "verbose" });
		const seen = [];
		api.slothlet.lifecycle.on("permission:owner-allow", (data) => {
			seen.push(data);
		});
		expect(await outcome(() => api.launcher.main.activate())).toEqual({ ok: true, value: "created" });
		// Lifecycle delivery is asynchronous.
		await new Promise((resolve) => setTimeout(resolve, 0));
		const hit = seen.find((e) => e.caller === "launcher.main.activate" && String(e.target).startsWith("launcher.session"));
		expect(hit).toBeDefined();
		expect(hit.moduleID).toEqual(expect.any(String));
	});
});

describe("Permissions > owner grant (#509) > config validation", () => {
	it.each([["yes"], [1], [null], [{}]])("rejects owner: %j with INVALID_CONFIG", async (value) => {
		await expect(slothlet({ base: BASE, permissions: { defaultPolicy: "deny", owner: value } })).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});
	});

	it("accepts owner: true and owner: false", async () => {
		for (const owner of [true, false]) {
			const inst = await slothlet({ base: BASE, permissions: { defaultPolicy: "deny", owner } });
			expect(typeof inst.core.alpha.callBeta).toBe("function");
			await inst.shutdown();
		}
	});
});
