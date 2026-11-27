/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-attribution-generator-steps.test.vitest.mjs
 *	@Date: 2026-11-27T00:00:00-08:00 (1795766400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T00:00:00-08:00 (1795766400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A generator leaf's body runs when whoever holds the generator steps it, not when the leaf is called.
 * Under either `permissions.caller.attribution` its steps are code the leaf handed out, run by the stepper: the
 * definer and the stepper both have to be allowed, as for a closure the leaf returned.
 *
 * @description
 * - Fixture `api_test_attribution_generator_steps`: `callee` may call the vault's secret; `supplier` may call
 *   `callee.**` and may not call the secret. The supplier steps the callee's generator (spread, `next()`, `for…of`) and
 *   its async generator (`next()`, `for await…of`, `Array.fromAsync`): refused under `"precise"` and `"fast"`.
 * - The callee stepping its own generators, and the host stepping them, read the secret.
 * - Fixture `api_test_caller_supplied_round5`: the code the callee hands out, run by the supplier, under `"fast"` as
 *   under `"precise"` (see permissions-caller-supplied-round5.test.vitest.mjs).
 *
 * @module tests/vitests/suites/permissions/permissions-attribution-generator-steps
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, "../../../../api_tests/api_test_attribution_generator_steps");
const ROUND5 = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND5;

/** Deny by default; the secret is the callee's alone. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.ping", effect: "allow" },
	{ caller: "supplier.**", target: "callee.**", effect: "allow" },
	{ caller: "supplier.**", target: "supplier.**", effect: "allow" },
	{ caller: "callee.**", target: "callee.**", effect: "allow" }
];

/** The round5 fixture's rules (see permissions-caller-supplied-round5.test.vitest.mjs). */
const ROUND5_RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "supplier.**", target: "callee.**", effect: "allow" },
	{ caller: "supplier.**", target: "supplier.**", effect: "allow" },
	{ caller: "callee.**", target: "supplier.**", effect: "allow" }
];

const DENIED = "PERMISSION_DENIED";
const SECRET = "s3cret";

describe.each(getMatrixConfigs())("Permissions > attribution > a generator leaf's steps > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the base, loading the vault first, and mount the callee and the supplier as modules of their own.
	 * @param {"precise"|"fast"} attribution - How the definer is known.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (attribution) => {
		api = await slothlet({
			...config,
			base: path.join(DIR, "base"),
			permissions: { policy: "deny", rules: RULES, caller: { attribution } }
		});
		await api.vault.secret.ping();
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { id: "callee-mod" });
		await api.slothlet.api.add("supplier", path.join(DIR, "supplier"), { id: "supplier-mod" });
		return api;
	};

	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		it.each(["spread", "next", "forOf"])("a generator stepped by the supplier (%s) is refused", async (how) => {
			await build(attribution);
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.steps.sync(how))).toBe(DENIED);
		});

		it.each(["next", "forAwait", "fromAsync"])("an async generator stepped by the supplier (%s) is refused", async (how) => {
			await build(attribution);
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.steps.async(how))).toBe(DENIED);
		});

		it.each(["ownSpread", "ownAsync", "selfSpread"])("control: the callee stepping its own (%s) reads the secret", async (name) => {
			await build(attribution);
			expect(await api.callee.gen[name]()).toBe(SECRET);
		});

		it("control: the host stepping the generator reads the secret", async () => {
			await build(attribution);
			expect([...(await api.callee.gen.makeGen())][0]).toBe(SECRET);
		});

		it("control: the host stepping the async generator reads the secret", async () => {
			await build(attribution);
			const generator = await api.callee.gen.makeAsyncGen();
			expect((await generator.next()).value).toBe(SECRET);
		});
	});
});

describe.each(getMatrixConfigs())("Permissions > attribution fast > code the callee hands out (round5) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the round5 base under `"fast"` and mount the callee, the supplier and the outsider.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({
			...config,
			base: path.join(ROUND5, "base"),
			hook: true,
			permissions: { policy: "deny", rules: ROUND5_RULES, caller: { attribution: "fast" } }
		});
		await api.vault.secret.whoami();
		await api.slothlet.api.add("callee", path.join(ROUND5, "callee"), { id: "callee-mod" });
		await api.slothlet.api.add("supplier", path.join(ROUND5, "supplier"), { id: "supplier-mod" });
		await api.slothlet.api.add("outsider", path.join(ROUND5, "outsider"), { id: "outsider-mod" });
		return api;
	};

	it.each(["direct", "getterExport"])("%s: run by the supplier, as the callee's own call through self", async (name) => {
		await build();
		expect(await api.supplier.probe.calleeMade(name)).toBe(SECRET);
	});

	it.each(["client", "object", "instanceMethod", "instanceGetter", "generator"])(
		"%s: run by the supplier, which may not reach what the callee may",
		async (name) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(async () => api.supplier.probe.calleeMade(name))).toBe(DENIED);
		}
	);

	it.each([
		["client", async () => (await api.callee.ops.makeClient())()],
		["object", async () => (await api.callee.ops.makeObject()).fn()],
		["instanceMethod", async () => (await api.callee.ops.makeInstance()).secret()],
		["instanceGetter", async () => (await api.callee.ops.makeInstance()).g],
		["generator", async () => [...(await api.callee.ops.makeGen())][0]]
	])("%s: run by the host", async (_name, run) => {
		await build();
		expect(await run()).toBe(SECRET);
	});
});
