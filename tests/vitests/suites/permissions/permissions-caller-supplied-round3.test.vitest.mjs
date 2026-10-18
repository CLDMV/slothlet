/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-round3.test.vitest.mjs
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
 * @fileoverview #597 — code supplied to a leaf gains nothing of the leaf's: a file name in the leaf's folder, code on
 * an api object, a slothlet function's plain-JavaScript shape, and a leaf resuming among other timers.
 *
 * @description
 * Fixture: `callee` (mounted) may call `vault.secret.secret`; `supplier` (mounted) may call `callee.**` and its own
 * module, and may not call the secret. Each test is a way of getting the supplier's code run as the callee: compiled
 * under a file name inside the callee's folder (one that does not exist, its own leaf file, its CommonJS helper), or
 * put on the supplier's api objects — an iterator, an accessor defined or assigned at runtime — for the callee to run.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-round3
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";
import { shapeOf } from "../../../../api_tests/api_test_caller_supplied_round3/callee/__lib/shape.mjs";

const DIR = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND3;

/** Deny by default; the secret is the callee's alone. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "supplier.**", target: "callee.**", effect: "allow" },
	{ caller: "supplier.**", target: "supplier.**", effect: "allow" },
	{ caller: "callee.**", target: "supplier.bag.**", effect: "allow" }
];

const DENIED = { ok: false, code: "PERMISSION_DENIED" };

/**
 * Whether this engine gives a stack frame the hash of the script it runs in, which is what tells code compiled under
 * a file name from that file's own.
 * @type {boolean}
 */
const HAS_SCRIPT_HASH = (() => {
	const previous = Error.prepareStackTrace;
	Error.prepareStackTrace = (_error, sites) => sites;
	const sites = new Error().stack;
	Error.prepareStackTrace = previous;
	return typeof sites?.[0]?.getScriptHash === "function";
})();

const KINDS = ["runInThisContext", "Script", "compileFunction", "moduleCompile"];

describe.each(getMatrixConfigs())("Permissions > caller-supplied code, third round (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the base and mount the callee and the supplier as modules of their own.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({
			...config,
			base: path.join(DIR, "base"),
			permissions: { defaultPolicy: "deny", rules: RULES }
		});
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		await api.slothlet.api.add("supplier", path.join(DIR, "supplier"), { moduleID: "supplier-mod" });
		// The vault is loaded up front, so code calling it synchronously gets its answer rather than a lazy load's promise.
		await api.vault.secret.whoami();
		return api;
	};

	describe("code compiled under a file name in the callee's folder", () => {
		describe.each(["zz-not-real.mjs", "ops.mjs", "__lib/helper.cjs"])("%s", (file) => {
			it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: is not the callee's own code", async (kind) => {
				await build();
				expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.forgedInFolder(kind, file))).toEqual(DENIED);
			});

			it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: the vault sees the supplier", async (kind) => {
				await build();
				expect(await api.supplier.probe.forgedInFolder(kind, file, "whoami")).toEqual({
					ok: true,
					value: "supplier.probe.forgedInFolder"
				});
			});
		});

		it("control: the callee's own CommonJS helper is the callee's code in a call handed an object", async () => {
			await build();
			expect(await api.supplier.probe.ownHelperControl()).toEqual({ ok: true, value: "s3cret" });
		});
	});

	describe("code on the supplier's api objects, run by the callee", () => {
		it.each([
			["iteratorThroughCallee", ["PERMISSION_DENIED"]],
			["symbolThroughCallee", "PERMISSION_DENIED"],
			["definedGetterThroughCallee", "PERMISSION_DENIED"],
			["assignedGetterThroughCallee", "PERMISSION_DENIED"],
			["valuesThroughCallee", [1, "PERMISSION_DENIED"]]
		])("%s: runs as the supplier", async (probe, value) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe[probe]())).toEqual({ ok: true, value });
		});

		it("control: a getter defined at runtime, read by its own module, runs as that module", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.definedGetterOwn())).toEqual({
				ok: true,
				value: "PERMISSION_DENIED"
			});
		});

		it("control: a getter defined at runtime keeps its attributes and reads through the node", async () => {
			await build();
			const late = api.supplier.bag.late;
			Object.defineProperty(late, "plain", { get: () => 7, enumerable: false, configurable: true });
			const descriptor = Object.getOwnPropertyDescriptor(late, "plain");
			expect([late.plain, descriptor.enumerable, descriptor.configurable, typeof descriptor.get]).toEqual([7, false, true, "function"]);
			expect(Object.keys(late)).not.toContain("plain");
		});
	});

	describe("a leaf resuming among other timers due in the same turn", () => {
		it("the supplier's toString it converts runs as the supplier", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.supplier.probe.laterAmongTimers())).toEqual(DENIED);
		});

		it("control: its own call after the timer is its own", async () => {
			await build();
			expect(await api.supplier.probe.ownAmongTimers()).toEqual({ ok: true, value: "s3cret" });
		});
	});
});

describe.each(getMatrixConfigs())(
	"Permissions off > a slothlet function a module reads behaves as plain JavaScript (#597) > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		it.each(["scope", "event.on", "lockCaller", "lockCaller.caller", "metadata.caller"])(
			"%s: in, delete, freeze and reads after a freeze report as on the host's function",
			async (name) => {
				api = await slothlet({ ...config, base: path.join(DIR, "base") });
				await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
				const read = api.callee.shapes.of(name);
				await api.shutdown();
				api = await slothlet({ ...config, base: path.join(DIR, "base") });
				const plain = shapeOf(name.split(".").reduce((node, key) => node[key], api.slothlet));
				expect(read).toEqual(plain);
				expect(JSON.stringify(read)).not.toContain("threw");
			}
		);
	}
);
