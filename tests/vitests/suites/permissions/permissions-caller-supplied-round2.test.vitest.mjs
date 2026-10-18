/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-round2.test.vitest.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — code a caller hands a leaf gains nothing of the leaf's, whichever way it gets there.
 *
 * @description
 * Code supplied to another module's call runs as its supplier, under that call as its ceiling. Each test here is a
 * way of getting the supplier's code run as the callee anyway: compiled under the callee's own file name, put into
 * a value after the callee checked it, a slothlet function bound for the callee to call, a getter the callee reads,
 * a pin taken inside the callee's call that sheds that call later, a write to something the callee owns, and a
 * versioned path the two would be routed differently on.
 *
 * Fixture: `callee` (mounted) may call `vault.secret.secret`; `supplier` (mounted) may call `callee.**` and
 * `vault.secret.forSupplier`, and may not call the secret; `callee2` may call `vault.secret.forSupplier`, and the
 * callee may not. `keeper` may call the secret and exposes it through a getter.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-round2
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND2;

/** Deny by default; the secret is the callee's and the keeper's alone. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "keeper.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "supplier.**", target: "vault.secret.forSupplier", effect: "allow" },
	{ caller: "callee2.**", target: "vault.secret.forSupplier", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "supplier.**", target: "vault.secret.gate", effect: "allow", requires: ["leak"] },
	{ caller: "supplier.**", target: "callee.**", effect: "allow" },
	{ caller: "supplier.**", target: "callee2.**", effect: "allow" },
	{ caller: "supplier.**", target: "supplier.**", effect: "allow" },
	{ caller: "supplier.**", target: "keeper.**", effect: "allow" },
	{ caller: "callee.**", target: "callee.**", effect: "allow" },
	{ caller: "callee.**", target: "callee2.**", effect: "allow" },
	{ caller: "callee.**", target: "supplier.hooks.**", effect: "allow" },
	{ caller: "callee.**", target: "supplier.bag.**", effect: "allow" },
	{ caller: "callee.**", target: "slothlet.lockCaller.caller", effect: "allow" },
	{ caller: "supplier.**", target: "slothlet.permissions.principal.**", effect: "allow" },
	{ caller: "callee.**", target: "slothlet.permissions.principal.**", effect: "allow" },
	{ caller: "**", target: "slothlet.scope", effect: "allow" },
	// The slothlet functions themselves, so binding one reads what it needs to: the tests are about who calling it is.
	{ caller: "**", target: "slothlet.scope.**", effect: "allow" },
	{ caller: "**", target: "slothlet.event.**", effect: "allow" },
	{ caller: "**", target: "slothlet.hook.**", effect: "allow" }
];

const DENIED = { ok: false, code: "PERMISSION_DENIED" };

/**
 * Whether this engine gives a stack frame the hash of the script it runs in, which is what tells code compiled under
 * another module's file name from that module's own.
 * @type {boolean}
 */
const HAS_SCRIPT_HASH = (() => {
	const previous = Error.prepareStackTrace;
	Error.prepareStackTrace = (_error, sites) => sites;
	const sites = new Error().stack;
	Error.prepareStackTrace = previous;
	return typeof sites?.[0]?.getScriptHash === "function";
})();

describe.each(getMatrixConfigs())("Permissions > caller-supplied code, second round (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the base and mount the callee and the supplier as modules of their own.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (permissions = {}) => {
		api = await slothlet({
			...config,
			base: path.join(DIR, "base"),
			hook: true,
			permissions: { defaultPolicy: "deny", rules: RULES, events: { default: "allow" }, ...permissions }
		});
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		await api.slothlet.api.add("supplier", path.join(DIR, "supplier"), { moduleID: "supplier-mod" });
		return api;
	};

	describe("code compiled under the callee's file name", () => {
		it.runIf(HAS_SCRIPT_HASH).each(["runInThisContext", "Script", "compileFunction", "moduleCompile"])(
			"%s: is not the callee's own code",
			async (kind) => {
				await build();
				expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.forged(kind))).toEqual(DENIED);
			}
		);

		it.runIf(HAS_SCRIPT_HASH).each(["runInThisContext", "Script", "compileFunction", "moduleCompile"])(
			"%s: the vault sees the supplier",
			async (kind) => {
				await build();
				expect(await api.supplier.probe.forged(kind, "whoami")).toEqual({ ok: true, value: "supplier.probe.forged" });
			}
		);
	});

	describe("a plain value changed after the callee took it", () => {
		it.each(["laterToString", "laterGetter", "laterPrototype", "laterListEntry", "reentrantToString"])(
			"%s: the code it gains is the supplier's",
			async (probe) => {
				await build();
				expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe[probe]())).toEqual(DENIED);
			}
		);
	});

	describe("a slothlet function bound for the callee to call", () => {
		it("event.on: the subscription is the supplier's, under the callee", async () => {
			await build();
			expect((await api.supplier.probe.boundEventOn()).ok).toBe(true);
			await api.slothlet.event.emit("round2.leak", {});
			await api.supplier.probe.settle();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.heardOutcome())).toEqual({
				who: { ok: true, value: "supplier.probe.boundEventOn" },
				secret: DENIED
			});
		});

		it("hook.on: registering a hook on the callee's target is refused", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.boundHookOn())).toEqual(DENIED);
		});

		it("principal.register: the resolver does not run as the callee", async () => {
			await build();
			expect((await api.supplier.probe.boundPrincipal()).ok).toBe(true);
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.resolvedOutcome())).toEqual(DENIED);
		});

		it("scope: the scope does not run as the callee", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.boundScope())).toEqual(DENIED);
		});

		it("control: lockCaller.caller is refused to a supplier that may not take it", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.boundLockCallerCaller())).toEqual(DENIED);
		});
	});

	describe("a getter on an api object", () => {
		it("the supplier's getter, read by the callee, runs as the supplier", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.getterThroughCallee())).toEqual(DENIED);
		});

		it("control: the keeper's getter, read by the host, runs as the keeper", async () => {
			await build();
			expect(await api.keeper.box.held.value).toBe("s3cret");
		});

		it("control: the keeper's getter, read by the supplier, gets no more than the supplier may", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.keeperGetter())).toEqual(DENIED);
		});
	});

	describe("a ceiling taken inside the callee's call", () => {
		it("by default, code handed on to a second callee is held to the supplier and that callee", async () => {
			await build();
			expect(await api.supplier.probe.nestedPin()).toEqual({ ok: true, value: "supplied" });
		});

		it("with ceilingChain, it survives a pin and a second callee the pinned code hands code to", async () => {
			await build({ ceilingChain: true });
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.nestedPin())).toEqual(DENIED);
		});

		it("ceilingChain must be a boolean", async () => {
			await expect(
				slothlet({ ...config, base: path.join(DIR, "base"), permissions: { defaultPolicy: "deny", ceilingChain: "yes" } })
			).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		});

		it("with ceilingChain, the module's own code is not held to anything", async () => {
			await build({ ceilingChain: true });
			expect(await api.supplier.probe.ownCallThroughCallee2()).toEqual({ ok: true, value: "supplied" });
		});
	});

	describe("writes the callee owns", () => {
		it("a member under the callee's mount is refused to the supplier's code", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.plantInCallee())).toEqual({
				ok: false,
				code: "LOOSE_SET_NOT_OWNED"
			});
		});

		it("control: the callee assigns under its own mount", async () => {
			await build();
			expect(await api.callee.ops.plantOwn()).toBe(1);
		});

		it("a context key the callee's scope owns is refused to the supplier's code", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.writeCalleeContext())).toEqual({
				ok: false,
				code: "CONTEXT_KEY_PROTECTED"
			});
		});

		it("control: the callee writes the key its scope owns", async () => {
			await build();
			expect(await api.callee.ops.scopedOwnWrite()).toBe("rewritten");
		});
	});
});

describe.each(getMatrixConfigs())("Permissions > caller-supplied code on a versioned path (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build with the supplier routed to v2 and the callee to v1, each allowed only its own version.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({
			...config,
			base: path.join(DIR, "base"),
			versionDispatcher: (_allVersions, caller) => {
				const apiPath = caller?.metadata?.apiPath ?? "";
				if (apiPath.startsWith("supplier.")) return "v2";
				if (apiPath.startsWith("callee.")) return "v1";
				return null;
			},
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "supplier.**", target: "callee.**", effect: "allow" },
					{ caller: "supplier.**", target: "v2.auth.**", effect: "allow" },
					{ caller: "callee.**", target: "v1.auth.**", effect: "allow" }
				]
			}
		});
		await api.slothlet.api.add("auth", path.join(DIR, "auth-v1"), { moduleID: "auth-v1" }, { version: "v1", default: true });
		await api.slothlet.api.add("auth", path.join(DIR, "auth-v2"), { moduleID: "auth-v2" }, { version: "v2" });
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		await api.slothlet.api.add("supplier", path.join(DIR, "supplier"), { moduleID: "supplier-mod" });
		return api;
	};

	it("control: each is routed to its own version", async () => {
		await build();
		expect(await api.supplier.probe.versionDirect()).toEqual({ ok: true, value: "v2" });
		expect(await api.callee.ops.whichAuth()).toBe("v1");
	});

	it("where the two disagree, no version either may not call is reached", async () => {
		await build();
		expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.versionInCallee())).toEqual(DENIED);
	});
});
