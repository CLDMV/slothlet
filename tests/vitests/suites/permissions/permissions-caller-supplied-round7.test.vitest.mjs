/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-round7.test.vitest.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T11:50:04-07:00 (1792349404)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — while a module a module added is being built, the host's own calls stay the host's: only code
 * of the instance's own is refused as no module's.
 *
 * @description
 * Fixture: `callee` (mounted) may call `vault.secret.secret` and `slothlet.api.**`; `slowplug`, which the callee adds,
 * awaits at its top level before it calls the vault.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-round7
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import path from "node:path";
import v8 from "node:v8";
import vm from "node:vm";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const DIR = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND7;

/** The fifth round's fixture, whose supplier exports a Proxy whose traps call the vault. */
const DIR5 = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND5;

/** Deny by default; the secret is the callee's alone. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "callee.**", target: "slothlet.api.**", effect: "allow" }
];

/**
 * How a module's code is refused while it is built as no module's: refused as unattributable, or — in the live
 * runtime, whose `self` names no instance outside a call — refused any context at all.
 */
const BUILD_REFUSALS = new Set(["PERMISSION_DENIED", "RUNTIME_NO_ACTIVE_CONTEXT_SELF"]);

/** The callee's rules, and the same for the module that adds by a relative folder. */
const REL_RULES = [
	...RULES,
	{ caller: "reladder.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "reladder.**", target: "slothlet.api.**", effect: "allow" }
];

/**
 * What a call answered: its value, or the code it was refused with.
 * @param {function(): *} call - The call.
 * @returns {Promise<*>} The answer.
 */
const answerOf = async (call) => {
	try {
		return await call();
	} catch (error) {
		return error?.code ?? String(error);
	}
};

/**
 * Run something, collecting the errors left uncaught or unhandled while its deferred work settles.
 * @param {function(): Promise<void>} run - What to run.
 * @returns {Promise<Array<string>>} Their codes.
 */
const uncaughtDuring = async (run) => {
	const previous = { rejection: process.listeners("unhandledRejection"), exception: process.listeners("uncaughtException") };
	const reported = [];
	const listener = (reason) => reported.push(reason?.code ?? reason?.message ?? String(reason));
	process.removeAllListeners("unhandledRejection");
	process.removeAllListeners("uncaughtException");
	process.on("unhandledRejection", listener);
	process.on("uncaughtException", listener);
	try {
		await run();
		await new Promise((resolve) => setTimeout(resolve, 50));
	} finally {
		process.removeListener("unhandledRejection", listener);
		process.removeListener("uncaughtException", listener);
		for (const handler of previous.rejection) process.on("unhandledRejection", handler);
		for (const handler of previous.exception) process.on("uncaughtException", handler);
	}
	return reported;
};

describe.each(getMatrixConfigs())("Permissions > caller-supplied code, seventh round (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the base, loading the vault first, and mount the callee as a module of its own.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({ ...config, base: path.join(DIR, "base"), hook: true, permissions: { defaultPolicy: "deny", rules: RULES } });
		await api.vault.secret.whoami();
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		return api;
	};

	describe("while a module the callee adds is built, the host's calls are the host's", () => {
		it("the host calls the vault and the callee meanwhile", async () => {
			await build();
			const adding = api.callee.adder.addWhile(path.join(DIR, "slowplug"));
			expect(await api.vault.secret.secret()).toBe("s3cret");
			expect(await api.callee.adder.sync()).toBe("s3cret");
			expect(await adding).toBe("s3cret");
			expect(await api.vault.secret.secret()).toBe("s3cret");
		});

		it("the added module's top level after its await is still refused", async () => {
			await build();
			const adding = api.callee.adder.addWhile(path.join(DIR, "slowplug"));
			await api.vault.secret.secret();
			await adding;
			const answers = await api.slowplug.probe.taken();
			expect(answers.length).toBe(2);
			expect(answers.filter((answer) => !BUILD_REFUSALS.has(answer))).toEqual([]);
		});

		it("an add the callee started and left: its module's top level is refused, the host's calls are the host's", async () => {
			await build();
			expect(await api.callee.adder.addDetached(path.join(DIR, "slowplug"))).toBe("started");
			expect(await api.vault.secret.secret()).toBe("s3cret");
			expect(await api.callee.adder.sync()).toBe("s3cret");
			expect(await api.callee.adder.detachedSettled()).toBe("added");
			const answers = await api.slowplug.probe.taken();
			expect(answers.length).toBe(2);
			expect(answers.filter((answer) => !BUILD_REFUSALS.has(answer))).toEqual([]);
		});

		it("two adds in flight at once", async () => {
			await build();
			const first = api.callee.adder.addWhile(path.join(DIR, "slowplug"), "slowA");
			const second = api.callee.adder.addWhile(path.join(DIR, "slowplug"), "slowB");
			expect(await api.vault.secret.secret()).toBe("s3cret");
			expect(await Promise.all([first, second])).toEqual(["s3cret", "s3cret"]);
			for (const name of ["slowA", "slowB"]) {
				const answers = await api[name].probe.taken();
				expect(answers.length).toBe(2);
				expect(answers.filter((answer) => !BUILD_REFUSALS.has(answer))).toEqual([]);
			}
		});

		it("an add that throws leaves the host's calls the host's", async () => {
			await build();
			const adding = api.callee.adder.addWhile(path.join(DIR, "brokenplug")).then(
				() => "added",
				() => "threw"
			);
			expect(await api.vault.secret.secret()).toBe("s3cret");
			expect(await withSuppressedSlothletErrorOutput(() => adding)).toBe("threw");
			expect(await api.vault.secret.secret()).toBe("s3cret");
			expect(await api.callee.adder.sync()).toBe("s3cret");
		});
	});
});

describe.each(getMatrixConfigs())("Permissions > host calls while a module's add is in flight (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the base and mount the modules that add others.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({ ...config, base: path.join(DIR, "base"), hook: true, permissions: { defaultPolicy: "deny", rules: REL_RULES } });
		await api.vault.secret.whoami();
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		await api.slothlet.api.add("reladder", path.join(DIR, "reladder"), { moduleID: "reladder-mod" });
		return api;
	};

	it.each(["lib", "./lib", "../plugins"])(
		"a module adds %s: host code in a folder of that name is the host's, the added module's top level is refused",
		async (folder) => {
			await build();
			const libHost = await import(path.join(DIR, "host", "lib", "caller.mjs"));
			const plainHost = await import(path.join(DIR, "plain", "caller.mjs"));
			const adding = api.reladder.adder.addRelative(folder, "relplug");
			expect(await answerOf(() => libHost.callSecret(api))).toBe("s3cret");
			expect(await answerOf(() => plainHost.callSecret(api))).toBe("s3cret");
			expect(await adding).toBe("s3cret");
			const answers = await api.relplug.probe.taken();
			expect(answers.length).toBe(2);
			expect(answers.filter((answer) => !BUILD_REFUSALS.has(answer))).toEqual([]);
		}
	);

	it("host code 250 calls deep is the host's", async () => {
		await build();
		const plainHost = await import(path.join(DIR, "plain", "caller.mjs"));
		const adding = api.callee.adder.addWhile(path.join(DIR, "slowplug"));
		expect(await answerOf(() => plainHost.callDeep(api, 250))).toBe("s3cret");
		expect(await adding).toBe("s3cret");
		const answers = await api.slowplug.probe.taken();
		expect(answers.filter((answer) => !BUILD_REFUSALS.has(answer))).toEqual([]);
	});
});

describe.each(getMatrixConfigs())("A promise a module's callback returns is left as it is (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const KINDS = ["native", "own", "subclass", "realm"];

	it.each(KINDS)("a %s promise the callback handles leaves nothing unhandled", async (kind) => {
		api = await slothlet({ ...config, base: path.join(DIR, "base"), hook: true });
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		const reported = await uncaughtDuring(async () => {
			await api.callee.adder.timerReturns(kind, true);
		});
		expect(reported).toEqual([]);
	});

	it.each(KINDS)("a %s promise the callback leaves unhandled is reported once", async (kind) => {
		api = await slothlet({ ...config, base: path.join(DIR, "base"), hook: true });
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		const reported = await uncaughtDuring(async () => {
			await api.callee.adder.timerReturns(kind, false);
		});
		expect(reported).toEqual([`round7-${kind}`]);
	});
});

describe.each(getMatrixConfigs({ runtime: "live" }))(
	"Live runtime > a promise followed for a callback is let go (#597) > $name",
	({ config }) => {
		let api;
		let original;
		let active;

		beforeEach(() => {
			original = v8.promiseHooks.onSettled;
			active = 0;
			// Count the settle hooks installed and not yet stopped.
			v8.promiseHooks.onSettled = (hook) => {
				active++;
				const stop = original(hook);
				let stopped = false;
				return () => {
					if (!stopped) active--;
					stopped = true;
					stop();
				};
			};
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
			v8.promiseHooks.onSettled = original;
		});

		it("a callback's promise that never settles stops being followed when its instance shuts down", async () => {
			api = await slothlet({ ...config, base: path.join(DIR, "base"), hook: true });
			await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
			await api.callee.adder.timerHangs();
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(active).toBe(1);
			await api.shutdown();
			api = null;
			expect(active).toBe(0);
		});

		it("a callback's promise is followed without running an inspector of its own", async () => {
			api = await slothlet({ ...config, base: path.join(DIR, "base"), hook: true });
			await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
			await api.callee.adder.timerInspectable();
			await new Promise((resolve) => setTimeout(resolve, 40));
			expect(await api.callee.adder.inspected()).toBe(0);
		});

		it("a callback's promise that never settles and nothing holds stops being followed once it is collected", async () => {
			v8.setFlagsFromString("--expose-gc");
			const gc = vm.runInNewContext("gc");
			api = await slothlet({ ...config, base: path.join(DIR, "base"), hook: true });
			await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
			await api.callee.adder.timerHangs();
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(active).toBe(1);
			for (let round = 0; round < 20 && active > 0; round++) {
				gc();
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			expect(active).toBe(0);
		});
	}
);

describe.each(getMatrixConfigs({ runtime: "live", mode: "lazy" }))(
	"Live runtime > reload with a module exporting a Proxy (#597) > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		it("callbacks the Proxy's traps left pending run through the reload without anything left uncaught", async () => {
			api = await slothlet({
				...config,
				base: path.join(DIR5, "base"),
				hook: true,
				permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target: "slothlet.**", effect: "allow" }] }
			});
			await api.slothlet.api.add("supplier", path.join(DIR5, "supplier"), { moduleID: "supplier-mod" });
			const reported = await uncaughtDuring(async () => {
				expect((await api.supplier.trap.p).x).toBe(1);
				await api.slothlet.reload();
			});
			expect(reported).toEqual([]);
			const answers = await api.supplier.trap.taken();
			expect(answers.length).toBeGreaterThan(0);
			expect(answers.filter((answer) => answer === "s3cret")).toEqual([]);
		});

		it("the Proxy held past shutdown no longer runs its traps", async () => {
			api = await slothlet({ ...config, base: path.join(DIR5, "base"), hook: true });
			await api.slothlet.api.add("supplier", path.join(DIR5, "supplier"), { moduleID: "supplier-mod" });
			const held = await api.supplier.trap.p;
			expect(held.x).toBe(1);
			await api.shutdown();
			api = null;
			let code = null;
			try {
				void held.x;
			} catch (error) {
				code = error?.code ?? String(error);
			}
			expect(code).toBe("CONTEXT_NOT_FOUND");
		});
	}
);
