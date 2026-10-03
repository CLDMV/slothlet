/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/lock-caller-caller.test.vitest.mjs
 *	@Date: 2026-09-28 00:00:00 -07:00 (1790578800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 00:00:00 -07:00 (1790578800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #477 — `self.slothlet.lockCaller.caller(fn)` pins the current leaf's CALLER onto a
 * callback, so a service that runs callbacks on behalf of whoever called it (a scheduler, a registry)
 * runs each one as that caller rather than as itself. Acting as your caller is a privilege: the path
 * `slothlet.lockCaller.caller` is denied to every module by a built-in rule and granted by the host.
 *
 * Fixture: `scheduler.service` stores jobs (`every` pins the caller, `everyAsSelf` pins itself via
 * plain `lockCaller`); `client.app` schedules jobs that call `target.probe.*`, which reports / gates on
 * the identity it is called with; `roles.registry` owns a #459 principal.
 *
 * @module tests/vitests/suites/permissions/lock-caller-caller
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_LOCK_CALLER_CALLER;

/** The host grant that lets the scheduler pin its callers. */
const GRANT = { caller: "scheduler.**", target: "slothlet.lockCaller.caller", effect: "allow" };

/** `target.probe.guarded` is for the client only. */
const GUARD_RULES = [
	{ caller: "scheduler.**", target: "target.probe.guarded", effect: "deny" },
	{ caller: "client.**", target: "target.probe.guarded", effect: "allow" }
];

/** Under `defaultPolicy: "deny"`, the calls the fixture makes besides the one under test. */
const DENY_POLICY_BASE_RULES = [
	{ caller: "client.**", target: "scheduler.**", effect: "allow" },
	{ caller: "client.**", target: "target.probe.whoami", effect: "allow" },
	{ caller: "scheduler.**", target: "target.probe.whoami", effect: "allow" }
];

/** The job each client scheduling leaf pins — the identity a pinned job runs as. */
const CLIENT_WHOAMI = "client.app.scheduleWhoami";

/**
 * Assert an invocation fails with `PERMISSION_DENIED`, whether it throws synchronously (eager) or
 * rejects (lazy first call).
 * @param {() => unknown} invoke - Zero-arg thunk.
 * @returns {Promise<void>}
 */
const expectDenied = (invoke) =>
	withSuppressedSlothletErrorOutput(async () => {
		let error;
		try {
			await invoke();
		} catch (err) {
			error = err;
		}
		expect(error).toBeDefined();
		expect(error.code).toBe("PERMISSION_DENIED");
	});

describe.each(getMatrixConfigs())("Permissions > lockCaller.caller (#477) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.scheduler.service.clear();
			await api.shutdown();
		}
		api = null;
	});

	/**
	 * Build the fixture api.
	 * @param {object[]} rules - Permission rules.
	 * @param {"allow"|"deny"} [defaultPolicy="allow"] - Default policy.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (rules, defaultPolicy = "allow") => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy, rules } });
		await api.scheduler.service.clear();
		return api;
	};

	// ── Pinning the caller ──────────────────────────────────────────────────────

	it("pins the leaf's caller, not the leaf: the target sees the client that scheduled the job", async () => {
		await build([GRANT]);
		await api.client.app.scheduleWhoami();
		expect(await api.scheduler.service.fire()).toEqual([CLIENT_WHOAMI]);
	});

	it("plain lockCaller in the same leaf pins the service itself (the problem lockCaller.caller solves)", async () => {
		await build([GRANT]);
		await api.client.app.scheduleWhoamiAsService();
		expect(await api.scheduler.service.fire()).toEqual(["scheduler.service.everyAsSelf"]);
	});

	it("a permission rule keyed to the caller applies inside the pinned job", async () => {
		await build([GRANT, ...GUARD_RULES]);
		await api.client.app.scheduleGuarded();
		expect(await api.scheduler.service.fire()).toEqual(["guarded-ok"]);

		// Pinned to the scheduler instead, the same job is denied.
		await api.scheduler.service.clear();
		await api.client.app.scheduleGuardedAsService();
		await expectDenied(() => api.scheduler.service.fire());
	});

	it("the pinned identity holds regardless of which module fires the job", async () => {
		await build([GRANT]);
		await api.client.app.scheduleWhoami();
		// Fired from inside the client (ambient client.app.fireFromClient → scheduler.service.fire).
		expect(await api.client.app.fireFromClient()).toEqual([CLIENT_WHOAMI]);
	});

	// ── No module caller ────────────────────────────────────────────────────────

	it("a leaf called from the host pins no module caller: the job runs as the host", async () => {
		await build([GRANT]);
		const job = () => ({ seen: api.target.probe.whoami(), caller: api.slothlet.metadata.caller() });
		await api.scheduler.service.every(job);

		// Fired from inside a module — a passthrough would run the job as scheduler.service.fire.
		const [result] = await api.client.app.fireFromClient();
		expect(await result.seen).toBeNull();
		expect(result.caller).toBeNull();
	});

	it("the host pin is a real wrapper, not a passthrough of fn", async () => {
		await build([GRANT]);
		const job = () => 1;
		await api.scheduler.service.every(job);
		const [wrapper] = await api.scheduler.service.list();
		expect(wrapper).not.toBe(job);
		expect(wrapper._slothletOriginal).toBe(job);
		expect(wrapper()).toBe(1);
	});

	it("host code calling lockCaller.caller directly gets a host pin and does not throw", async () => {
		await build([]);
		const job = () => api.target.probe.whoami();
		const pinned = api.slothlet.lockCaller.caller(job);
		expect(pinned).not.toBe(job);
		expect(await pinned()).toBeNull();
	});

	it("an async host-pinned job keeps running as the host across an await", async () => {
		await build([GRANT]);
		await api.scheduler.service.every(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			return api.target.probe.whoami();
		});
		const [job] = await api.scheduler.service.list();
		expect(await job()).toBeNull();
	});

	// Async runtime only — the same caveat lockCaller carries. The live runtime keeps one identity slot
	// per instance, so while the job is parked at its await, the modules awaiting it (client → scheduler)
	// are suspended too; the job's resumed call is then attributed from the stack, which names the
	// awaiting scheduler frame. That fails closed (a module identity, not the host), but it is not the pin.
	it.skipIf(config.runtime === "live")(
		"async runtime: a host-pinned job fired from inside a module runs as the host across an await",
		async () => {
			await build([GRANT]);
			await api.scheduler.service.every(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
				return api.target.probe.whoami();
			});
			expect(await api.client.app.fireFromClient()).toEqual([null]);
		}
	);

	it("concurrent async host-pinned jobs all run as the host", async () => {
		await build([GRANT]);
		const job = async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			return api.target.probe.whoami();
		};
		await api.scheduler.service.every(job);
		await api.scheduler.service.every(job);
		const [first, second] = await api.scheduler.service.list();
		// Invoked straight from the host so only the two host-pinned jobs are in flight.
		expect(await Promise.all([first(), second()])).toEqual([null, null]);
	});

	// ── Permission gate ─────────────────────────────────────────────────────────

	it("is denied to a module without a grant under defaultPolicy allow", async () => {
		await build([]);
		await expectDenied(() => api.client.app.scheduleWhoami());
		await expectDenied(() => api.client.app.pinDirectly());
	});

	it("is denied to a module without a grant under defaultPolicy deny", async () => {
		await build(DENY_POLICY_BASE_RULES, "deny");
		await expectDenied(() => api.client.app.scheduleWhoami());
		await expectDenied(() => api.client.app.pinDirectly());
	});

	it("is allowed with a host grant under defaultPolicy deny", async () => {
		await build([...DENY_POLICY_BASE_RULES, GRANT], "deny");
		await api.client.app.scheduleWhoami();
		expect(await api.scheduler.service.fire()).toEqual([CLIENT_WHOAMI]);
		// The grant is scoped: the client itself still may not pin its caller.
		await expectDenied(() => api.client.app.pinDirectly());
	});

	it("the built-in exact allow on slothlet.lockCaller does not cover slothlet.lockCaller.caller", async () => {
		await build([GRANT], "deny");
		const global = api.slothlet.permissions.global;
		expect(global.checkAccess("client.app", "slothlet.lockCaller")).toBe(true);
		expect(global.checkAccess("client.app", "slothlet.lockCaller.caller")).toBe(false);
		expect(global.checkAccess("scheduler.service", "slothlet.lockCaller.caller")).toBe(true);
	});

	it("the built-in deny applies under defaultPolicy allow too", async () => {
		await build([]);
		const global = api.slothlet.permissions.global;
		expect(global.checkAccess("anyModule", "slothlet.lockCaller")).toBe(true);
		expect(global.checkAccess("anyModule", "slothlet.lockCaller.caller")).toBe(false);
	});

	// ── Principals (#459) ───────────────────────────────────────────────────────

	/**
	 * Rules for the principals tests: the client may read a project its roles grant "read" on.
	 * @type {object[]}
	 */
	const PRINCIPAL_RULES = [
		GRANT,
		{ caller: "client.**", target: "scheduler.**", effect: "allow" },
		{ caller: "roles.**", target: "slothlet.permissions.principal.**", effect: "allow" },
		{
			caller: "client.**",
			target: "target.probe.files",
			effect: "allow",
			requires: ["roles"],
			condition: (ctx, { args, principals }) => principals.roles.projects[args[0]]?.includes("read") === true
		}
	];

	/**
	 * Build the principals fixture: the roles principal registered and u1 granted read on p1.
	 * @returns {Promise<(ctx: object, fn: () => unknown) => unknown>} A per-request context runner.
	 */
	const buildPrincipals = async () => {
		await build(PRINCIPAL_RULES, "deny");
		await api.roles.registry.setup();
		await api.roles.registry.grant("u1", "p1", ["read"]);
		return (ctx, fn) => api.slothlet.context.run(ctx, fn);
	};

	it("principals: the pinned caller's principal-gated rule applies inside the job", async () => {
		const as = await buildPrincipals();
		// Resolve u1's roles once through a direct client call, so the job takes the synchronous path.
		expect(await as({ user: "u1" }, () => api.client.app.readFiles("p1"))).toEqual({ projectId: "p1" });

		await api.client.app.scheduleFiles();
		expect(await as({ user: "u1" }, () => api.scheduler.service.fire("p1"))).toEqual([{ projectId: "p1" }]);
		// Same identity, a project its roles grant nothing on: the resolved facts deny it.
		await expectDenied(() => as({ user: "u1" }, () => api.scheduler.service.fire("p2")));

		// Pinned to the scheduler, the client rule never matches.
		await api.scheduler.service.clear();
		await api.client.app.scheduleFilesAsService();
		await expectDenied(() => as({ user: "u1" }, () => api.scheduler.service.fire("p1")));
	});

	// Async runtime only: a stale principal promotes the call past an await, and in the live runtime the
	// deferred enforcement is attributed from the stack while the scheduler is suspended awaiting the job —
	// the same caveat lockCaller carries (see the async host-pin test above).
	it.skipIf(config.runtime === "live")("async runtime: a principal is resolved for the pinned caller from inside the job", async () => {
		const as = await buildPrincipals();
		await api.client.app.scheduleFiles();
		// No prior resolve: the job's call is promoted to resolve u1's roles, then gated on them.
		expect(await as({ user: "u1" }, () => api.scheduler.service.fire("p1"))).toEqual([{ projectId: "p1" }]);
		await expectDenied(() => as({ user: "u2" }, () => api.scheduler.service.fire("p1")));
	});

	// ── lockCaller parity ───────────────────────────────────────────────────────

	it("errors thrown by the job propagate unchanged", async () => {
		await build([GRANT]);
		await api.client.app.scheduleThrow();
		const [wrapper] = await api.scheduler.service.list();
		let error;
		try {
			wrapper();
		} catch (err) {
			error = err;
		}
		expect(error).toBeInstanceOf(TypeError);
		expect(error.message).toBe("job-boom");

		const hostPinned = api.slothlet.lockCaller.caller(() => {
			throw new RangeError("host-boom");
		});
		expect(() => hostPinned()).toThrow(RangeError);
	});

	it("forwards `this` and arguments into the job", async () => {
		await build([GRANT]);
		await api.client.app.scheduleThisAndArgs();
		const thisArg = { tag: "the-this" };
		const [result] = await api.scheduler.service.fireWith(thisArg, 1, 2);
		expect(result.self).toBe(thisArg);
		expect(result.args).toEqual([1, 2]);
	});

	it("exposes the original function via `_slothletOriginal`", async () => {
		await build([GRANT]);
		const { wrapper, original } = await api.client.app.pinThroughScheduler();
		expect(wrapper._slothletOriginal).toBe(original);
		expect(wrapper()).toBe("original");
	});

	it("the identity is captured at call time and cannot be changed afterwards", async () => {
		await build([GRANT]);
		await api.client.app.scheduleWhoami();
		const [wrapper] = await api.scheduler.service.list();
		// Invoked from the host, from another module, and again — always the client.
		expect(await wrapper()).toBe(CLIENT_WHOAMI);
		expect(await api.client.app.fireFromClient()).toEqual([CLIENT_WHOAMI]);
		expect(await wrapper()).toBe(CLIENT_WHOAMI);
	});

	it("rejects a non-function argument", async () => {
		await build([]);
		let error;
		try {
			api.slothlet.lockCaller.caller(123);
		} catch (err) {
			error = err;
		}
		expect(error?.code).toBe("INVALID_ARGUMENT");
	});

	it("a pinned job still targets the live instance after a full reload", async () => {
		// Identity marker: only the client is denied the guarded route, so a denial naming the client proves
		// the job still runs as the client (the host and the scheduler would both be allowed).
		await build([GRANT, { caller: "client.**", target: "target.probe.guarded", effect: "deny" }]);
		await api.client.app.scheduleGuarded();
		const [wrapper] = await api.scheduler.service.list();
		/**
		 * Invoke the pinned job and return the error it raised.
		 * @returns {Promise<Error|undefined>} The error.
		 */
		const invoke = () =>
			withSuppressedSlothletErrorOutput(async () => {
				try {
					await wrapper();
				} catch (err) {
					return err;
				}
				return undefined;
			});
		const before = await invoke();
		expect(before?.code).toBe("PERMISSION_DENIED");
		expect(before?.message).toContain("client.app.scheduleGuarded");

		await api.slothlet.reload();
		const after = await invoke();
		expect(after?.code).toBe("PERMISSION_DENIED");
		expect(after?.message).toContain("client.app.scheduleGuarded");
	});

	// Same runtime-mode behaviour as lockCaller (see the lock-caller runtime suite): the identity is held
	// across the job's await in both runtimes.
	it("an async job keeps the pinned caller across an await", async () => {
		await build([GRANT]);
		await api.client.app.scheduleAsyncWhoami();
		expect(await api.scheduler.service.fire()).toEqual(["client.app.scheduleAsyncWhoami"]);
	});

	it("plain lockCaller is unchanged: a function, host passthrough, and reachable .caller", async () => {
		await build([]);
		expect(typeof api.slothlet.lockCaller).toBe("function");
		expect(typeof api.slothlet.lockCaller.caller).toBe("function");
		const fn = () => 42;
		expect(api.slothlet.lockCaller(fn)).toBe(fn);
		expect(api.slothlet.lockCaller(fn)()).toBe(42);
	});

	it("lockCaller.caller is reachable through self for a granted module", async () => {
		await build([{ caller: "client.**", target: "slothlet.lockCaller.caller", effect: "allow" }]);
		const pinned = await api.client.app.pinDirectly();
		expect(typeof pinned).toBe("function");
		expect(pinned()).toBe(0);
	});
});
