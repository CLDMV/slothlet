/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-attribution.test.vitest.mjs
 *	@Date: 2026-11-08T19:14:17-08:00 (1794194057)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T22:59:44-08:00 (1794207584)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #726 — `permissions.attribution`: how the definer of code a module hands out is known.
 *
 * @description
 * - `"precise"` (the default): a returned value that is itself code is a stand-in recording its definer, so the definer
 *   is known where the stack cannot tell it (here: with `provenance` off, and for a closure built by the `Function` constructor). It
 *   grants the definer's rights to no one: whoever runs it is its ceiling.
 * - `"fast"`: nothing is wrapped, so a returned function is `===` itself every time; every definer comes from the
 *   stack, and where the stack cannot tell it the access is refused with `PERMISSION_DENIED`.
 * - A CommonJS file two instances load: precise tells the instances apart by its stand-ins; fast cannot, as the
 *   file's frames carry its path and not the instance, and refuses.
 * - `"precise"` tells the definer from the stack wherever the stack can (a helper a leaf returns is its file's module's);
 *   the stand-in's record is only the fallback.
 * - Either way, plain data comes back as itself at any depth, and with the permission system not on nothing is
 *   wrapped at all, nothing is checked, and code of a removed node or a shut-down instance runs as plain JavaScript.
 *
 * Fixture `api_test_definer_rule` (see permissions-definer-rule.test.vitest.mjs). Rules: `bag.** -> vault.**`,
 * `** -> bag.**`, `** -> shared.**`, `mixed.trusted -> vault.**`; default deny. Expected values come from the rule as
 * the maintainer decided it on #726 and from PERMISSIONS.md.
 *
 * @module tests/vitests/suites/permissions/permissions-attribution
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import { spawnSync } from "node:child_process";
import slothlet from "@cldmv/slothlet";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "../../../../api_tests/api_test_definer_rule");
const DENIED = "PERMISSION_DENIED";
const NO_SELF = "RUNTIME_NO_ACTIVE_CONTEXT_SELF";
const RULES = [
	{ caller: "bag.**", target: "vault.**", effect: "allow" },
	{ caller: "**", target: "bag.**", effect: "allow" },
	{ caller: "**", target: "shared.**", effect: "allow" },
	{ caller: "mixed.trusted", target: "vault.**", effect: "allow" }
];
const MODES = [];
for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) MODES.push({ name: `${mode}/${runtime}`, mode, runtime });

/**
 * Run code from the host, reporting a refusal by its code.
 * @param {Function} fn - The code.
 * @returns {Promise<*>} What it returned, or the code of what it threw.
 */
const settle = async (fn) => {
	try {
		return await fn();
	} catch (e) {
		return e?.code ?? String(e?.message ?? e);
	}
};

let api = null;
afterEach(async () => {
	await api?.shutdown();
	api = null;
});

/**
 * An instance of the fixture, with the nodes the tests touch loaded.
 * @param {object} options - `mode`, `runtime` and the `permissions` fields to add.
 * @returns {Promise<object>} The api.
 */
async function open({ mode, runtime, ...permissions }) {
	api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions: { defaultPolicy: "deny", rules: RULES, ...permissions } });
	await api.vault.get();
	await api.shared.take();
	await api.bag.echo(1);
	return api;
}

describe("Permissions > attribution > validation (#726)", () => {
	it.each([["bogus"], [""], [5], [true], [null], [{}]])("rejects attribution %j with a translated INVALID_CONFIG", async (attribution) => {
		const error = await slothlet({ base: DIR, silent: true, permissions: { attribution } }).then(
			(made) => {
				api = made;
				return null;
			},
			(e) => e
		);
		expect(error).toMatchObject({ name: "SlothletError", code: "INVALID_CONFIG" });
		expect(error.message).toContain("permissions.attribution");
		expect(error.message).toContain('"precise" | "fast"');
	});

	it.each([["precise"], ["fast"], [undefined]])("accepts attribution %j", async (attribution) => {
		api = await slothlet({ base: DIR, silent: true, permissions: { attribution } });
		expect(await api.vault.get()).toBe(42);
	});

	it("leaves attribution unread with no permissions config", async () => {
		api = await slothlet({ base: DIR, silent: true });
		expect(await api.vault.get()).toBe(42);
	});
});

describe.each(MODES)("Permissions > attribution: precise > $name (#726)", ({ mode, runtime }) => {
	it("hands out a returned closure as a stand-in, and plain data as itself", async () => {
		await open({ mode, runtime });
		const fn = await api.bag.make();
		expect(types.isProxy(fn)).toBe(true);
		const data = { list: [{ deep: [{ x: 1 }] }] };
		const out = await api.bag.same({ data });
		expect(out.data).toBe(data);
		const box = await api.bag.box();
		expect(types.isProxy(box)).toBe(false);
		expect(typeof box.run).toBe("function");
	});

	it("knows a returned closure's definer without the stack: with provenance off, the host runs it as bag.make", async () => {
		await open({ mode, runtime, provenance: false });
		const fn = await api.bag.make();
		expect(await settle(() => fn())).toBe(42);
	});

	it("knows the definer of a closure built by the Function constructor without the stack, with provenance off", async () => {
		await open({ mode, runtime, provenance: false });
		const fn = await api.bag.evaled();
		expect(await settle(() => fn())).toBe(42);
	});

	it("grants nothing with the stand-in: supplier running bag's closure is refused, with provenance off too", async () => {
		await open({ mode, runtime, provenance: false });
		const supplier = await api.supplier.run();
		expect(supplier.A).toBe(DENIED);
		expect(supplier.instance).toBe(DENIED);
	});

	it("with provenance off, code nested in returned data is found when it is handed out and runs as its definer, under whoever runs it", async () => {
		await open({ mode, runtime, provenance: false });
		// No frames are read, so the data a module returns is searched for code instead: the host runs it as `bag`, which
		// may read the vault, and a module that may not is still refused as its caller.
		const box = await api.bag.box();
		expect(await settle(() => box.run())).toBe(42);
		const supplier = await api.supplier.run();
		expect(supplier.B).toBe(DENIED);
	});

	it("tells the definer from the stack where it can: a helper bag's leaf returns is the file's module's, not that leaf's", async () => {
		api = await slothlet({
			base: DIR,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "deny", rules: [...RULES, { caller: "mixed.trustedHands", target: "vault.**", effect: "allow" }] }
		});
		const helper = await api.mixed.trustedHands();
		expect(types.isProxy(helper)).toBe(true);
		expect(await settle(() => helper())).toBe(DENIED);
	});

	it("falls back on the recorded definer only where the stack cannot tell: with provenance off, the stand-in's leaf", async () => {
		api = await slothlet({
			base: DIR,
			mode,
			runtime,
			silent: true,
			permissions: {
				defaultPolicy: "deny",
				provenance: false,
				rules: [...RULES, { caller: "mixed.trustedHands", target: "vault.**", effect: "allow" }]
			}
		});
		const helper = await api.mixed.trustedHands();
		expect(await settle(() => helper())).toBe(42);
	});

	it("refuses a closure built by the Function constructor with provenance on: inside its call, evaluated code names no file", async () => {
		await open({ mode, runtime });
		const fn = await api.bag.evaled();
		expect(await settle(() => fn())).toBe(DENIED);
	});
});

describe.each(MODES)("Permissions > attribution: fast > $name (#726)", ({ mode, runtime }) => {
	it("hands a returned function out as itself: === holds and it is no Proxy", async () => {
		await open({ mode, runtime, attribution: "fast" });
		const first = await api.bag.keptFn();
		expect(types.isProxy(first)).toBe(false);
		expect(await api.bag.keptFn()).toBe(first);
		expect(types.isProxy(await api.bag.make())).toBe(false);
	});

	it("hands the caller's own values back as themselves, at the top and nested", async () => {
		await open({ mode, runtime, attribution: "fast" });
		const h = () => 1;
		expect(await api.bag.same(h)).toBe(h);
		expect((await api.bag.same([h]))[0]).toBe(h);
		const data = { list: [{ deep: [{ x: 1 }] }] };
		expect((await api.bag.same({ data })).data).toBe(data);
	});

	it("refuses a closure built by the Function constructor, run by the host, with PERMISSION_DENIED: the stack cannot tell its definer", async () => {
		await open({ mode, runtime, attribution: "fast" });
		const fn = await api.bag.evaled();
		expect(await settle(() => fn())).toBe(DENIED);
	});

	it("refuses code outside every export, run by the host, with PERMISSION_DENIED (the file's module, mixed)", async () => {
		await open({ mode, runtime, attribution: "fast" });
		const helper = await api.mixed.viaHelper();
		const error = await Promise.resolve()
			.then(() => helper())
			.then(
				() => null,
				(e) => e
			);
		expect(error?.code).toBe(DENIED);
		expect(error.message).toContain("'mixed'");
	});

	it("with provenance off, no definer is told from the stack: the host running a returned closure has no self", async () => {
		await open({ mode, runtime, attribution: "fast", provenance: false });
		const fn = await api.bag.make();
		expect(await settle(() => fn())).toBe(NO_SELF);
		const supplier = await api.supplier.run();
		expect(supplier.A).toBe(DENIED);
	});
});

/**
 * As {@link runCommonJSPair}, with the host running each closure inside a `run()` flow of an instance: the flow names
 * the instance whose code is running, which the frames of a CommonJS file do not.
 * @param {string} attribution - The attribution value for both instances.
 * @param {string} mode - Eager or lazy.
 * @param {string} runtime - Async or live.
 * @returns {{own: Array<*>, other: Array<*>}} What each closure returned, run in its own instance's flow and in the
 *   other instance's, or the code of what it threw.
 */
function runCommonJSPairInFlow(attribution, mode, runtime) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const settle = async (fn) => { try { return await fn(); } catch (e) { return e?.code ?? String(e?.message ?? e); } };
		const base = ${JSON.stringify(path.resolve(HERE, "../../../../api_tests/api_test_definer_rule_cjs"))};
		const pair = [];
		for (const rules of [[{ caller: "bag.**", target: "vault.**", effect: "allow" }], []]) {
			const instance = await slothlet({ base, mode: ${JSON.stringify(mode)}, runtime: ${JSON.stringify(runtime)}, silent: true,
				permissions: { defaultPolicy: "deny", attribution: ${JSON.stringify(attribution)}, rules } });
			await settle(() => instance.vault.get());
			pair.push(instance);
		}
		const closures = await Promise.all(pair.map((instance) => instance.bag.make()));
		const out = { own: [], other: [] };
		for (let i = 0; i < 2; i++) out.own.push(await settle(() => pair[i].slothlet.context.run({}, () => closures[i]())));
		for (let i = 0; i < 2; i++) out.other.push(await settle(() => pair[i].slothlet.context.run({}, () => closures[1 - i]())));
		for (const instance of pair) await instance.shutdown();
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		process.exit(0);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: path.resolve(HERE, "../../../.."),
		encoding: "utf8",
		timeout: 120000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe.each(MODES)(
	"Permissions > attribution > a CommonJS file two running instances load, in a flow that names the instance > $name",
	({ mode, runtime }) => {
		// The first instance lets bag read the vault, the second does not. Inside an instance's flow the code of a
		// CommonJS file both hold is that instance's: checked under that instance's rules.
		it("precise: each closure keeps the instance that made it, whichever flow runs it", () => {
			// A stand-in records its instance: the first instance's closure reads the vault it may read, the second's is
			// refused, and run in the other instance's flow each still answers by its own instance's rules.
			expect(runCommonJSPairInFlow("precise", mode, runtime)).toEqual({ own: [42, DENIED], other: [DENIED, 42] });
		});

		it("fast: the code is the running instance's, where a flow names one", () => {
			// Nothing records where a closure came from, so the flow decides: in the first instance's flow the code is
			// that instance's bag (allowed), in the second's it is that instance's bag (denied), whichever closure runs.
			expect(runCommonJSPairInFlow("fast", mode, runtime)).toEqual({ own: [42, DENIED], other: [42, DENIED] });
		});
	}
);

describe.each(MODES)("Permissions > attribution > removed and shut-down modules > $name (#726)", ({ mode, runtime }) => {
	it.each([["precise"], ["fast"]])("%s: code of a removed node has no standing", async (attribution) => {
		await open({ mode, runtime, attribution });
		const fn = await api.bag.make();
		const box = await api.bag.box();
		expect(await settle(() => fn())).toBe(42);
		await api.slothlet.api.remove("bag");
		expect([DENIED, NO_SELF]).toContain(await settle(() => fn()));
		expect(await settle(() => box.run())).toBe(NO_SELF);
	});

	it.each([["precise"], ["fast"]])("%s: code of a shut-down instance has no standing", async (attribution) => {
		await open({ mode, runtime, attribution });
		const fn = await api.mixed.trusted();
		expect(await settle(() => fn())).toBe(42);
		await api.shutdown();
		api = null;
		expect(await settle(() => fn())).toBe(NO_SELF);
	});
});

describe.each(MODES)("Permissions > attribution > permissions not on > $name (#726)", ({ mode, runtime }) => {
	const CONFIGS = [
		["no permissions config", undefined],
		['mode: "off"', { mode: "off" }],
		["enabled: false", { enabled: false }],
		['mode: "disabled"', { mode: "disabled" }],
		['mode: "off", attribution: "fast"', { mode: "off", attribution: "fast" }]
	];
	it.each(CONFIGS)("%s: nothing is wrapped, and handed-out code still runs with self", async (_label, permissions) => {
		api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions });
		const fn = await api.bag.make();
		expect(types.isProxy(fn)).toBe(false);
		expect(await api.bag.keptFn()).toBe(await api.bag.keptFn());
		expect(await settle(() => fn())).toBe(42);
		const box = await api.bag.box();
		expect(types.isProxy(box)).toBe(false);
		expect(await settle(() => box.run())).toBe(42);
		const data = { list: [{ deep: [{ x: 1 }] }] };
		expect((await api.bag.same({ data })).data).toBe(data);
	});

	it.each(CONFIGS)("%s: code of a removed node is not set aside, and runs as plain JavaScript", async (_label, permissions) => {
		api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions });
		const fn = await api.bag.make();
		const box = await api.bag.box();
		await api.slothlet.api.remove("bag");
		expect(await settle(() => fn())).toBe(42);
		expect(await settle(() => box.run())).toBe(42);
	});

	it.each(CONFIGS)(
		"%s: code of a shut-down instance runs as plain JavaScript, inside another instance's call",
		async (_label, permissions) => {
			const gone = await slothlet({ base: DIR, mode, runtime, silent: true, permissions });
			api = await slothlet({ base: DIR, mode, runtime, silent: true, permissions });
			const fn = await gone.bag.make();
			await gone.shutdown();
			expect(await settle(() => api.bag.call(fn))).toBe(42);
			expect(await settle(() => fn())).toBe(NO_SELF);
		}
	);
});

/**
 * Run the CommonJS fixture in a plain Node process: under vitest, a CommonJS leaf's own `import()` of slothlet's
 * runtime is Node's copy, not the one vite's runner gives the rest of the test, so `self` in it would see no call.
 * Two instances are built from the one folder, one whose rules let `bag` read the vault and one whose rules do not,
 * and the host runs the closure each instance's `bag.make` returned.
 * @param {string} attribution - The attribution value for both instances.
 * @param {string} mode - Eager or lazy.
 * @param {string} runtime - Async or live.
 * @returns {Array<*>} What each closure returned, or the code of what it threw.
 */
function runCommonJSPair(attribution, mode, runtime) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const settle = async (fn) => { try { return await fn(); } catch (e) { return e?.code ?? String(e?.message ?? e); } };
		const base = ${JSON.stringify(path.resolve(HERE, "../../../../api_tests/api_test_definer_rule_cjs"))};
		const pair = [];
		for (const rules of [[{ caller: "bag.**", target: "vault.**", effect: "allow" }], []]) {
			const instance = await slothlet({ base, mode: ${JSON.stringify(mode)}, runtime: ${JSON.stringify(runtime)}, silent: true,
				permissions: { defaultPolicy: "deny", attribution: ${JSON.stringify(attribution)}, rules } });
			await settle(() => instance.vault.get());
			pair.push(instance);
		}
		const closures = await Promise.all(pair.map((instance) => instance.bag.make()));
		const out = [];
		for (const fn of closures) out.push(await settle(() => fn()));
		for (const instance of pair) await instance.shutdown();
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		process.exit(0);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: path.resolve(HERE, "../../../.."),
		encoding: "utf8",
		timeout: 120000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe.each(MODES)("Permissions > attribution > a CommonJS file two instances load > $name (#726)", ({ mode, runtime }) => {
	it("precise: each instance's closure runs under that instance's rules", () => {
		expect(runCommonJSPair("precise", mode, runtime)).toEqual([42, DENIED]);
	});

	it("fast: the frames of a file two instances load name no instance, so both are refused", () => {
		expect(runCommonJSPair("fast", mode, runtime)).toEqual([DENIED, DENIED]);
	});
});
