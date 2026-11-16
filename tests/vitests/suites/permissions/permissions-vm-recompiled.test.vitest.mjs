/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-vm-recompiled.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A copy of a module's file, compiled or loaded again by another module under the file's own name, is
 * that other module's code (#691).
 *
 * @description
 * The reader may run the trusted modules' `run` and nothing of the vault's. It makes copies of the trusted modules'
 * exact sources under their own file names (`vm.compileFunction`, `Module#_compile`, a fresh `require` of the
 * CommonJS file, a raw `import` of the ES module, with or without the module's own tags, and a `vm.SourceTextModule`
 * where the engine has one). Each copy is a module of the reader's making: what it does is held to the reader's rules
 * inside the trusted module's call, inside the reader's own, and when the host runs it.
 *
 * @module tests/vitests/suites/permissions/permissions-vm-recompiled
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import vm from "node:vm";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_VM_RECOMPILED;

/** Deny by default; the secret is the trusted modules' alone. */
const RULES = [
	{ caller: "trusted.**", target: "vault.secret.**", effect: "allow" },
	{ caller: "trustedesm.**", target: "vault.secret.**", effect: "allow" },
	{ caller: "reader.**", target: "trusted.ops.run", effect: "allow" },
	{ caller: "reader.**", target: "trustedesm.ops.run", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "**", target: "slothlet.**", effect: "allow" }
];

const DENIED = { ok: false, code: "PERMISSION_DENIED" };

/**
 * Whether this engine gives a stack frame the hash of the script it runs in.
 * @type {boolean}
 */
const HAS_SCRIPT_HASH = (() => {
	const previous = Error.prepareStackTrace;
	Error.prepareStackTrace = (_error, sites) => sites;
	const sites = new Error().stack;
	Error.prepareStackTrace = previous;
	return typeof sites?.[0]?.getScriptHash === "function";
})();

/** The ways a copy is made; `vm.SourceTextModule` only where Node has it (`--experimental-vm-modules`). */
const KINDS = [
	"compileFunction",
	"moduleCompile",
	"require",
	"import",
	"importPlain",
	...(vm.SourceTextModule ? ["sourceTextModule"] : [])
];

/**
 * Capture a call's outcome.
 * @param {function(): *} invoke - The call.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 */
async function attempt(invoke) {
	try {
		return { ok: true, value: await invoke() };
	} catch (error) {
		return { ok: false, code: error?.code ?? String(error) };
	}
}

describe.each(getMatrixConfigs())("Permissions > a copy of a module's file is its maker's code (#691) > $name", ({ config }) => {
	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Build the base and mount the trusted modules and the reader.
		 * @returns {Promise<object>} The api.
		 */
		const build = async () => {
			api = await slothlet({
				...config,
				base: path.join(DIR, "base"),
				permissions: { defaultPolicy: "deny", rules: RULES, attribution }
			});
			await api.slothlet.api.add("trusted", path.join(DIR, "trusted"), { moduleID: "trusted-mod" });
			await api.slothlet.api.add("trustedesm", path.join(DIR, "trustedesm"), { moduleID: "trustedesm-mod" });
			await api.slothlet.api.add("reader", path.join(DIR, "reader"), { moduleID: "reader-mod" });
			return api;
		};

		it("control: the trusted modules' own code reaches the secret", async () => {
			await build();
			expect(await attempt(() => api.trusted.ops.read())).toEqual({ ok: true, value: "s3cret" });
			expect(await attempt(() => api.trustedesm.ops.read())).toEqual({ ok: true, value: "s3cret" });
			expect(await api.trusted.ops.who()).toBe("trusted.ops.who");
		});

		it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: run by the host, the copy is refused", async (kind) => {
			await build();
			const { fn } = await api.reader.probe.give(kind);
			expect(await withSuppressedSlothletErrorOutput(() => attempt(() => fn()))).toEqual(DENIED);
		});

		it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: run by the host, the vault does not see the trusted module", async (kind) => {
			await build();
			const { fn } = await api.reader.probe.give(kind, "who");
			const outcome = await withSuppressedSlothletErrorOutput(() => attempt(() => fn()));
			expect(outcome.ok && /^trusted/.test(String(outcome.value))).toBe(false);
		});

		it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: handed to the trusted module's call, the copy is refused", async (kind) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.reader.probe.handIn(kind))).toEqual(DENIED);
		});

		it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: run in the reader's own call, the copy is refused", async (kind) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.reader.probe.own(kind))).toEqual(DENIED);
		});
	});
});
