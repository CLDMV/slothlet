/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-vm-recompiled.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:49-08:00 (1794882649)
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
	// Code from strings is a built-in capability (D4 ruling part 1); this suite is about where such code is placed.
	{ caller: "**", target: "capability:code", effect: "allow" },
	{ caller: "trusted.**", target: "vault.secret.**", effect: "allow" },
	{ caller: "trustedesm.**", target: "vault.secret.**", effect: "allow" },
	{ caller: "reader.**", target: "trusted.ops.run", effect: "allow" },
	{ caller: "reader.**", target: "trustedesm.ops.run", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "**", target: "slothlet.**", effect: "allow" }
];

const DENIED = { ok: false, code: "PERMISSION_DENIED" };

/**
 * What a copy compiled in module code under the trusted module's real file name answers: the compile itself is refused
 * even where `capability:code` is opened (D8 ruling). Copies a real load makes (`require`, `import`) are refused later,
 * as no module's code.
 * @param {string} kind - How the copy is made.
 * @returns {{ok: false, code: string}} The refusal.
 */
const refusalFor = (kind) =>
	["compileFunction", "moduleCompile", "sourceTextModule"].includes(kind) ? PERMISSION_CAPABILITY_REFUSED : DENIED;
const PERMISSION_CAPABILITY_REFUSED = { ok: false, code: "PERMISSION_CAPABILITY_REFUSED" };

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
			expect(await withSuppressedSlothletErrorOutput(() => attempt(() => fn()))).toEqual(refusalFor(kind));
		});

		it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: run by the host, the vault does not see the trusted module", async (kind) => {
			await build();
			const { fn } = await api.reader.probe.give(kind, "who");
			const outcome = await withSuppressedSlothletErrorOutput(() => attempt(() => fn()));
			expect(outcome.ok && /^trusted/.test(String(outcome.value))).toBe(false);
		});

		it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: handed to the trusted module's call, the copy is refused", async (kind) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.reader.probe.handIn(kind))).toEqual(refusalFor(kind));
		});

		it.each([
			["a name no file holds", "planted.js"],
			["a missing file in the trusted module's folder", path.join(DIR, "trusted", "nothere.cjs")],
			["the trusted module's own file", path.join(DIR, "trusted", "ops.cjs")],
			["a missing file in the vault's folder", path.join(DIR, "base", "vault", "nothere.mjs")]
		])("vm code under %s, left for the trusted module to run, runs as no module", async (_label, filename) => {
			await build();
			await api.reader.probe.plantGlobal("__slothletVmCopyPlanted", undefined, filename);
			try {
				const outcome = await withSuppressedSlothletErrorOutput(() => attempt(() => api.trusted.ops.runGlobal("__slothletVmCopyPlanted")));
				// Refused: with no call it can be placed in, the live runtime gives it no `self` at all; under a real file name of
				// another module's, the compile itself is refused (D8 ruling).
				expect(outcome.ok).toBe(false);
				expect(["PERMISSION_DENIED", "CONTEXT_NOT_ACTIVE_SELF", "PERMISSION_CAPABILITY_REFUSED"]).toContain(outcome.code);
			} finally {
				delete globalThis.__slothletVmCopyPlanted;
			}
		});

		it("vm code under a missing file in the trusted module's folder, handed to its call, is refused", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.reader.probe.plantIn(path.join(DIR, "trusted", "nothere.cjs")))).toEqual(
				DENIED
			);
		});

		it.runIf(HAS_SCRIPT_HASH).each(KINDS)("%s: run in the reader's own call, the copy is refused", async (kind) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.reader.probe.own(kind))).toEqual(refusalFor(kind));
		});
	});
});

describe.each(getMatrixConfigs())(
	"Permissions > vm code named after a module's own ES module file, run in its call > $name",
	({ config }) => {
		describe.each(["precise", "fast"])("attribution %s", (attribution) => {
			let api;

			afterEach(async () => {
				delete globalThis.__slothletVmPlantedEsm;
				if (api) await api.shutdown();
				api = null;
			});

			/**
			 * Build the base and mount the trusted modules and the reader, the vault not loaded yet in lazy mode.
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

			// Lazy mode, before the vault has loaded: the call waits for the load and is decided after it, when the planted
			// code's frame is gone. It is decided as the code that made it, which names a file it was not loaded from (#691).
			it.each([
				["the call itself", "self.vault.secret.secret()", "runGlobal"],
				["a call it queues", "Promise.resolve().then(() => self.vault.secret.secret())", "runGlobal"],
				["the call, while the module's own access loads the vault", "self.vault.secret.secret()", "runDuringLoad"]
			])("%s is refused", async (_label, body, via) => {
				await build();
				await api.reader.probe.plantGlobal("__slothletVmPlantedEsm", body, path.join(DIR, "trustedesm", "ops.mjs"));
				for (const ops of [api.trusted.ops, api.trustedesm.ops]) {
					const outcome = await withSuppressedSlothletErrorOutput(() => attempt(() => ops[via]("__slothletVmPlantedEsm")));
					expect(outcome.ok).toBe(false);
					// The compile under another module's real file is refused itself (D8 ruling).
					expect(outcome.code).toBe("PERMISSION_CAPABILITY_REFUSED");
				}
			});
		});
	}
);

describe.each(getMatrixConfigs())("Permissions > a helper's code run by the host > $name", ({ config }) => {
	describe.each([
		["helpers per api file", "module"],
		["helpers per instance", undefined]
	])("%s", (_label, helpers) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		it("control: the trusted module reaches the secret through its helper", async () => {
			api = await slothlet({ ...config, helpers, base: path.join(DIR, "base"), permissions: { defaultPolicy: "deny", rules: RULES } });
			await api.slothlet.api.add("trustedesm", path.join(DIR, "trustedesm"), { moduleID: "trustedesm-mod" });
			expect(await attempt(() => api.trustedesm.ops.viaHelper())).toEqual({ ok: true, value: "s3cret" });
		});

		it.each(["precise", "fast"])(
			"a helper both import, handed out by the reader and run by the host, is refused (%s)",
			async (attribution) => {
				api = await slothlet({
					...config,
					helpers,
					base: path.join(DIR, "base"),
					permissions: { defaultPolicy: "deny", rules: RULES, attribution }
				});
				await api.slothlet.api.add("trustedesm", path.join(DIR, "trustedesm"), { moduleID: "trustedesm-mod" });
				await api.slothlet.api.add("reader", path.join(DIR, "reader"), { moduleID: "reader-mod" });
				// In lazy mode the vault loads first and the call is decided after: still as the helper's code, held to every
				// module importing it, as in eager mode.
				const { fn } = await api.reader.probe.sharedHelper();
				expect(await withSuppressedSlothletErrorOutput(() => attempt(() => fn()))).toEqual(DENIED);
			}
		);

		it("the reader's copy, loaded as the trusted module's helper copy and run by the host, is refused", async () => {
			api = await slothlet({ ...config, helpers, base: path.join(DIR, "base"), permissions: { defaultPolicy: "deny", rules: RULES } });
			await api.slothlet.api.add("trustedesm", path.join(DIR, "trustedesm"), { moduleID: "trustedesm-mod" });
			await api.slothlet.api.add("reader", path.join(DIR, "reader"), { moduleID: "reader-mod" });
			const { fn } = await api.reader.probe.helperCopy();
			expect(await withSuppressedSlothletErrorOutput(() => attempt(() => fn()))).toEqual(DENIED);
		});
	});
});
