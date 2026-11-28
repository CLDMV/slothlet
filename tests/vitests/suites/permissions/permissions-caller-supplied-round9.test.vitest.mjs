/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-caller-supplied-round9.test.vitest.mjs
 *	@Date: 2026-10-18T12:35:05-07:00 (1792352105)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:22-08:00 (1795869142)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — a relative add resolves from the file that asked for it even below a host file named
 * `slothlet.mjs`; a settled promise whose state cannot be read is let go once collected; and the folder a module adds
 * is told apart from the host's code however it is spelled.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-round9
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import path from "node:path";
import v8 from "node:v8";
import vm from "node:vm";
import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { stackHoldsInstanceCode } from "#handlers/frame-placement";
import { getMatrixConfigs, TEST_DIRS, apiPart } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND9;

/** The seventh round's fixture: a callee that adds a module whose top level awaits before it calls the vault. */
const DIR7 = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND7;

/** Where the symlinked spelling of the seventh round's slow module lives. */
const LINKS = path.join(process.cwd(), "tmp", "permissions-caller-supplied-round9");

/** Deny by default; the secret is the callee's alone. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "callee.**", target: "slothlet.api.**", effect: "allow" },
	// A module's add writes where it mounts, which only a host write grant lets it do outside its own subtree (#625).
	{ caller: "callee.**", target: "slowplug:write", effect: "allow" },
	{ caller: "callee.**", target: "slowplug.**:write", effect: "allow" }
];

/** How a module's code is refused while it is built as no module's (see the seventh round). */
const BUILD_REFUSALS = new Set(["PERMISSION_DENIED", "CONTEXT_NOT_ACTIVE_SELF"]);

beforeAll(() => {
	rmSync(LINKS, { recursive: true, force: true });
	mkdirSync(LINKS, { recursive: true });
	symlinkSync(apiPart(DIR7, "slowplug"), path.join(LINKS, "slowplug"), "dir");
	symlinkSync(apiPart(DIR, "held"), path.join(LINKS, "held"), "dir");
});

afterAll(() => {
	rmSync(LINKS, { recursive: true, force: true });
});

describe.each(getMatrixConfigs())("A relative add below a host file named slothlet.mjs (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("resolves from the file that asked for it, not from the host's own slothlet.mjs", async () => {
		api = await slothlet({ ...config, base: apiPart(DIR) });
		const main = await import(path.join(DIR, "lib", "host", "main.mjs"));
		await main.addThroughWrap(api, 15);
		expect(await api.p.where()).toBe("routes/plug");
	});
});

describe.each(getMatrixConfigs())("A module adds a folder however it is spelled (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["with a trailing slash", () => `${apiPart(DIR7, "slowplug")}/`],
		["through a parent segment", () => `${apiPart(DIR7, "brokenplug")}/../../api_test_caller_supplied_round7_slowplug/api`],
		["through a symlink", () => path.join(LINKS, "slowplug")]
	])("%s: the added module's top level after its await is refused", async (_label, folder) => {
		api = await slothlet({ ...config, base: apiPart(DIR7), hook: true, permissions: { policy: "deny", rules: RULES } });
		await api.vault.secret.whoami();
		await api.slothlet.api.add("callee", apiPart(DIR7, "callee"), { id: "callee-mod" });
		const adding = api.callee.adder.addWhile(folder());
		expect(await api.vault.secret.secret()).toBe("s3cret");
		expect(await adding).toBe("s3cret");
		const answers = await api.slowplug.probe.taken();
		expect(answers.length).toBe(2);
		expect(answers.filter((answer) => !BUILD_REFUSALS.has(answer))).toEqual([]);
	});
});

describe("A folder being built is told apart from the host's code however it is spelled (#597)", () => {
	it.each([
		["as it is", () => apiPart(DIR, "held")],
		["with a trailing slash", () => `${apiPart(DIR, "held")}/`],
		["through a parent segment", () => `${DIR}/lib/host/../../../api_test_caller_supplied_round9_held/api`],
		["through a current segment", () => `${DIR}_held/./api`],
		["through a symlink", () => path.join(LINKS, "held")]
	])("%s: code inside it is the instance's", async (_label, root) => {
		const { callFrom } = await import(path.join(apiPart(DIR, "held"), "call.mjs"));
		const sources = [{ family: "round9-unknown", slothlet: null, roots: [root()] }];
		expect(callFrom(() => stackHoldsInstanceCode(sources))).toBe(true);
		expect(stackHoldsInstanceCode(sources)).toBe(false);
	});
});

describe.each(getMatrixConfigs({ runtime: "live" }))(
	"Live runtime > a settled promise whose state cannot be read is let go (#597) > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		it.each(["meta", "cancel"])("timer callbacks returning a settled %s promise leave no call suspended once collected", async (kind) => {
			v8.setFlagsFromString("--expose-gc");
			const gc = vm.runInNewContext("gc");
			api = await slothlet({ ...config, base: apiPart(DIR) });
			await api.slothlet.api.add("ticker", apiPart(DIR, "ticker"), { id: "ticker-mod" });
			const manager = resolveWrapper(api.probe.ping).____slothlet.contextManager;
			const before = manager.suspendedCallCount;
			for (let batch = 0; batch < 3; batch++) {
				expect(await api.ticker.ticks(200, kind)).toBe(200);
				for (let round = 0; round < 20 && manager.suspendedCallCount > before; round++) {
					gc();
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
				expect(manager.suspendedCallCount).toBe(before);
			}
		});
	}
);
