/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-caller-supplied-round5.test.vitest.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T09:04:32-07:00 (1793462672)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #597 — code runs as the module that made it: a constructor body, a Proxy export's traps however they
 * are touched, code nested anywhere in what a module's functions return, and code a module hands out, which runs as
 * that module with no ceiling from whoever runs it. Values keep their plain-JavaScript identity and shape.
 *
 * @description
 * Fixture: `callee` (mounted) may call `vault.secret.secret`; `supplier` (mounted) may call `callee.**` and its own
 * module, and may not call the secret.
 *
 * @module tests/vitests/suites/permissions/permissions-caller-supplied-round5
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import util from "node:util";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";
import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import {
	installInstanceImportHooks,
	recordedScriptCount,
	recordedScriptHashes,
	releaseInstanceScope
} from "@cldmv/slothlet/helpers/instance-imports";
import { learnedScriptCount } from "#handlers/frame-placement";
import { moduleMakerCount, resolveWrapper } from "#handlers/unified-wrapper";

const DIR = TEST_DIRS.API_TEST_CALLER_SUPPLIED_ROUND5;

/** Deny by default; the secret is the callee's alone. */
const RULES = [
	{ caller: "callee.**", target: "vault.secret.secret", effect: "allow" },
	{ caller: "**", target: "vault.secret.whoami", effect: "allow" },
	{ caller: "supplier.**", target: "callee.**", effect: "allow" },
	{ caller: "supplier.**", target: "supplier.**", effect: "allow" },
	{ caller: "callee.**", target: "supplier.**", effect: "allow" },
	{ caller: "**", target: "slothlet.hook.**", effect: "allow" },
	{ caller: "callee.**", target: "slothlet.api.**", effect: "allow" },
	// A module's add writes where it mounts, which only a host write grant lets it do outside its own subtree (#625).
	{ caller: "callee.**", target: "plug:write", effect: "allow" },
	{ caller: "callee.**", target: "plug.**:write", effect: "allow" }
];

const DENIED = "PERMISSION_DENIED";

/**
 * How a module's code is refused while it is built as no module's: refused as unattributable, or — in the live
 * runtime, whose `self` names no instance outside a call — refused any context at all.
 */
const BUILD_REFUSALS = new Set([DENIED, "RUNTIME_NO_ACTIVE_CONTEXT_SELF"]);

/**
 * Whether this engine gives a stack frame the hash of the script it runs in, which is what tells a file's own code
 * from code compiled under its name.
 * @type {boolean}
 */
const HAS_SCRIPT_HASH = (() => {
	const previous = Error.prepareStackTrace;
	Error.prepareStackTrace = (_error, sites) => sites;
	const sites = new Error().stack;
	Error.prepareStackTrace = previous;
	return typeof sites?.[0]?.getScriptHash === "function";
})();

/** Whether this engine loads TypeScript, stripping its types. */
const STRIPS_TYPES = Boolean(process.features?.typescript);

/** The intrinsic prototype a generator's steps come from. */
const GENERATOR_PROTOTYPE = Object.getPrototypeOf(function* () {}).prototype;

describe.each(getMatrixConfigs())("Permissions > caller-supplied code, fifth round (#597) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the base, loading the vault first, and mount the callee, the supplier and the outsider as modules of
	 * their own.
	 * @param {object} [permissions] - Permissions to build with instead of the fixture's rules.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (permissions = { defaultPolicy: "deny", rules: RULES }) => {
		api = await slothlet({ ...config, base: path.join(DIR, "base"), hook: true, permissions });
		await api.vault.secret.whoami();
		await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
		await api.slothlet.api.add("supplier", path.join(DIR, "supplier"), { moduleID: "supplier-mod" });
		await api.slothlet.api.add("outsider", path.join(DIR, "outsider"), { moduleID: "outsider-mod" });
		return api;
	};

	/** Build with every call allowed, for the plain-JavaScript shape. */
	const buildOpen = () => build({ defaultPolicy: "allow", rules: [] });

	it("control: the callee's own call is its own", async () => {
		await build();
		expect(await api.callee.ops.secretDirect()).toBe("s3cret");
	});

	it.runIf(HAS_SCRIPT_HASH && STRIPS_TYPES)("control: the callee's TypeScript CommonJS helper is the callee's code", async () => {
		await build();
		expect(await api.callee.ops.ownViaTypeScript({})).toBe("s3cret");
	});

	describe("constructing the supplier's export runs its body as the supplier", () => {
		it.each(["constructNamed", "constructFn"])("%s: constructed by the callee through self", async (probe) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.callee.ops[probe]())).toBe(DENIED);
		});

		it.each(["Named", "Fn"])("%s: constructed by the host", async (name) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(async () => (await new api.supplier.ctor[name]()).v)).toBe(DENIED);
		});
	});

	describe("a Proxy the supplier exports runs its traps as the supplier however it is touched", () => {
		it("read by the callee through self", async () => {
			await build();
			await api.supplier.trap.taken();
			expect(await withSuppressedSlothletErrorOutput(() => api.callee.ops.readTrap())).toBe(1);
			const answers = await api.supplier.trap.taken();
			expect(answers.length).toBeGreaterThan(0);
			expect(answers.filter((answer) => answer !== DENIED)).toEqual([]);
		});

		it("read by the host", async () => {
			await build();
			await api.supplier.trap.taken();
			expect(await withSuppressedSlothletErrorOutput(async () => (await api.supplier.trap.p).x)).toBe(1);
			const answers = await api.supplier.trap.taken();
			expect(answers.length).toBeGreaterThan(0);
			expect(answers.filter((answer) => answer !== DENIED)).toEqual([]);
		});
	});

	describe("code nested in what the supplier returns runs as the supplier", () => {
		it.each([
			"objFn",
			"arrFn",
			"getter",
			"thenable",
			"iterable",
			"asyncIterable",
			"protoIter",
			"ownProp",
			"staticM",
			"protoCall",
			"newInstanceGetter",
			"newInstanceMethod",
			"instanceGetter",
			"instanceMethod",
			"boundPush",
			"boundNameless",
			"frozenGen",
			"frozenIter",
			"sealedIter"
		])("%s: run by the callee", async (name) => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.callee.ops.viaSelf(name))).toBe(DENIED);
		});

		it.each([
			["objFn", (shape) => shape.fn()],
			["getter", (shape) => shape.value],
			["thenable", async (shape) => await shape],
			["instanceGetter", (shape) => shape.g],
			["boundPush", (shape) => shape()]
		])("%s: run by the host", async (name, run) => {
			await build();
			const shape = await api.supplier.bag.shape(name === "instanceGetter" ? "instance" : name);
			expect(await withSuppressedSlothletErrorOutput(async () => run(shape))).toBe(DENIED);
		});
	});

	describe("code the callee hands out runs as the callee, whoever runs it", () => {
		it.each(["direct", "getterExport", "client", "object", "instanceMethod", "instanceGetter", "generator"])(
			"%s: run by the supplier, as the callee's own call through self",
			async (name) => {
				await build();
				expect(await api.supplier.probe.calleeMade(name)).toBe("s3cret");
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
			expect(await run()).toBe("s3cret");
		});

		it("an exported getter, read by a module no rule lets call the callee, is refused as a call would be", async () => {
			await build();
			expect(await withSuppressedSlothletErrorOutput(() => api.outsider.probe.readHeld())).toBe(DENIED);
		});

		it("a closure of the callee's handed back by the supplier's echo, called by the callee", async () => {
			await build();
			expect(await api.callee.ops.passThrough()).toBe("s3cret");
		});
	});

	describe("hooks and modules added at runtime", () => {
		it("a hook the supplier registers on the callee runs as the supplier", async () => {
			await build();
			await api.supplier.bag.hookCallee();
			expect(await api.callee.ops.ping()).toBe("pong");
			expect(await api.supplier.bag.taken()).toEqual([DENIED]);
		});

		it("a module the callee adds is added, and does not run as the callee while it is built", async () => {
			await build();
			await expect(api.callee.ops.addPlug(path.join(DIR, "plug"))).resolves.toBeUndefined();
			const answers = await api.plug.probe.taken();
			expect(answers.length).toBeGreaterThan(0);
			expect(answers.filter((answer) => !BUILD_REFUSALS.has(answer))).toEqual([]);
		});

		it("a module the callee reloads is reloaded, and does not run as the callee while it is rebuilt", async () => {
			await build();
			await api.callee.ops.addPlug(path.join(DIR, "plug"));
			await api.plug.probe.taken();
			await expect(api.callee.ops.reloadPlug()).resolves.toBeUndefined();
			const answers = await api.plug.probe.taken();
			expect(answers.length).toBeGreaterThan(0);
			expect(answers.filter((answer) => !BUILD_REFUSALS.has(answer))).toEqual([]);
		});
	});

	describe("a rejection a module's deferred callback leaves is reported as in plain JavaScript", () => {
		/**
		 * Run something, collecting the unhandled rejections reported while its deferred work settles.
		 * @param {function(): Promise<void>} run - What to run.
		 * @returns {Promise<Array<string>>} The messages reported.
		 */
		const unhandledDuring = async (run) => {
			const previous = process.listeners("unhandledRejection");
			const reported = [];
			const listener = (reason) => reported.push(reason?.message ?? String(reason));
			process.removeAllListeners("unhandledRejection");
			process.on("unhandledRejection", listener);
			try {
				await run();
				await new Promise((resolve) => setTimeout(resolve, 50));
			} finally {
				process.removeListener("unhandledRejection", listener);
				for (const handler of previous) process.on("unhandledRejection", handler);
			}
			return reported;
		};

		it.each(["timerRejects", "listenerRejects"])("%s: an unhandled rejection is reported once", async (probe) => {
			await build();
			const tag = `round5-${probe}-${Math.random()}`;
			expect(await unhandledDuring(() => api.callee.ops[probe](tag))).toEqual([tag]);
		});

		it.each(["timerHandles", "listenerHandles"])("%s: a rejection its own code handles is not reported", async (probe) => {
			await build();
			const tag = `round5-${probe}-${Math.random()}`;
			expect(await unhandledDuring(() => api.callee.ops[probe](tag))).toEqual([]);
		});
	});

	it("a module removed whole drops the record of what it made", async () => {
		await build({ defaultPolicy: "allow", rules: [] });
		const instance = resolveWrapper(api.callee).slothlet;
		await api.supplier.bag.klass();
		await api.callee.ops.makeClient();
		const before = moduleMakerCount(instance);
		expect(before).toBeGreaterThanOrEqual(2);
		await api.slothlet.api.remove("supplier-mod");
		expect(moduleMakerCount(instance)).toBe(before - 1);
	});

	describe("control: values keep their plain-JavaScript identity and shape", () => {
		it("a value handed in comes back as itself", async () => {
			await buildOpen();
			const fn = () => 1;
			const obj = { fn };
			expect(await api.supplier.bag.echo(fn)).toBe(fn);
			expect(await api.supplier.bag.echo(obj)).toBe(obj);
			const instance = new (class Host {
				ping() {
					return "pong";
				}
			})();
			expect(await api.supplier.bag.echo(instance)).toBe(instance);
		});

		it("the same class from two functions is the same value", async () => {
			await buildOpen();
			expect(await api.supplier.bag.klass()).toBe(await api.supplier.bag.sameClass());
		});

		it("a module's own value handed back is its own, inside a list and as a key too", async () => {
			await buildOpen();
			const own = await api.supplier.bag.same();
			expect(await api.supplier.bag.check(own)).toBe(true);
			expect(await api.supplier.bag.isOwnIn([own])).toBe(true);
			expect((await api.supplier.bag.keyed())(own)).toBe(true);
		});

		it("a returned class and its instances keep their constructor, prototype and statics", async () => {
			await buildOpen();
			const C = await api.supplier.bag.klass();
			const made = new C(2);
			expect(made.constructor).toBe(C);
			expect(C.prototype.constructor).toBe(C);
			expect(made instanceof C).toBe(true);
			expect(Object.getPrototypeOf(made)).toBe(C.prototype);
			expect(made.value).toBe(2);
			const instance = await api.supplier.bag.shape("instance");
			expect(instance instanceof C).toBe(true);
			expect(instance.constructor).toBe(C);
			expect(instance.m).toBe(made.m);
		});

		it("a returned generator function and async function report their kind", async () => {
			await buildOpen();
			const gen = await api.supplier.bag.genFn();
			const fn = await api.supplier.bag.asyncFn();
			expect(util.types.isGeneratorFunction(gen)).toBe(true);
			expect(util.types.isAsyncFunction(fn)).toBe(true);
			expect([gen.name, gen.length, fn.name, fn.length]).toEqual(["counted", 1, "awaited", 1]);
			expect([...gen(5)]).toEqual([5]);
			expect(await fn(3)).toBe(3);
		});

		it("a returned function's source is the function's", async () => {
			await buildOpen();
			expect((await api.supplier.bag.shaped()).toString()).toContain("shapedOne");
		});

		it("a returned generator object steps through the intrinsic next", async () => {
			await buildOpen();
			const generator = await api.supplier.bag.genObject();
			expect(generator.next).toBe(GENERATOR_PROTOTYPE.next);
			expect(Object.prototype.toString.call(generator)).toBe("[object Generator]");
			expect([...generator]).toEqual([1]);
		});
	});
});

describe("Instance imports > CommonJS sources recorded as they load (#597)", () => {
	/**
	 * The load hook slothlet registers, taken from a stand-in for `node:module`.
	 * @returns {Function} The load hook.
	 */
	const loadHook = () => {
		let hooks = null;
		installInstanceImportHooks({ registerHooks: (registered) => (hooks = registered) }, {});
		return hooks.load;
	};

	/** A URL no other test loads. */
	let counter = 0;
	const freshURL = (name) => `file:///round5/${process.pid}/${Date.now()}-${counter++}/${name}`;

	/** The hashes recorded for a URL's script, oldest first. */
	const recorded = (url) => recordedScriptHashes(url);

	/** The SHA-256 of a text. */
	const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

	it("a source loaded again is recorded once", () => {
		const load = loadHook();
		const url = freshURL("again.cjs");
		const next = () => ({ format: "commonjs", source: "module.exports = 1;\n" });
		load(url, {}, next);
		load(url, {}, next);
		expect(recorded(url)).toEqual([sha256("module.exports = 1;\n")]);
	});

	it("a file's sources are kept to a bounded number", () => {
		const load = loadHook();
		const url = freshURL("changing.cjs");
		for (let index = 0; index < 40; index++) load(url, {}, () => ({ format: "commonjs", source: `module.exports = ${index};\n` }));
		expect(recorded(url).length).toBeGreaterThan(0);
		expect(recorded(url).length).toBeLessThanOrEqual(16);
		expect(recorded(url).at(-1)).toBe(sha256("module.exports = 39;\n"));
	});

	it("an instance's sources are dropped when it shuts down", () => {
		const load = loadHook();
		const base = freshURL("cycle.mjs");
		const before = recordedScriptCount();
		for (let index = 0; index < 20; index++) {
			const instanceID = `round5-cycle-${process.pid}-${counter}-${index}`;
			load(`${base}?slothlet_instance=${instanceID}&module=m`, {}, () => ({ format: "module", source: `export const v = ${index};\n` }));
			expect(recordedScriptCount()).toBe(before + 1);
			releaseInstanceScope(instanceID);
			expect(recordedScriptCount()).toBe(before);
		}
	});

	it("a file reloaded again and again keeps one entry, with its newest few sources", () => {
		const load = loadHook();
		const base = freshURL("reloaded.mjs");
		const instanceID = `round5-reload-${process.pid}-${counter}`;
		const before = recordedScriptCount();
		for (let index = 0; index < 40; index++) {
			load(`${base}?slothlet_instance=${instanceID}&module=m&_reload=${index}`, {}, () => ({
				format: "module",
				source: `export const v = ${index};\n`
			}));
		}
		expect(recordedScriptCount()).toBe(before + 1);
		const hashes = recorded(`${base}?slothlet_instance=${instanceID}&module=m&_reload=40`);
		expect(hashes.length).toBe(16);
		expect(hashes.at(-1)).toBe(sha256("export const v = 39;\n"));
		releaseInstanceScope(instanceID);
		expect(recordedScriptCount()).toBe(before);
	});

	it("the recorded sources cannot be added to, dropped or redirected through the process-wide state", () => {
		const load = loadHook();
		const instanceID = `round5-kept-${process.pid}-${counter}`;
		const url = `${freshURL("kept.mjs")}?slothlet_instance=${instanceID}&module=m`;
		load(url, {}, () => ({ format: "module", source: "export const v = 1;\n" }));
		const forged = sha256("forged");
		const state = globalThis[Symbol.for("@cldmv/slothlet.instanceImportState")];
		const attempts = [
			() => state.scriptHashes?.get?.(state.scriptKeyOf?.(url) ?? url)?.push?.(forged),
			() => state.scriptHashes?.set?.(url, [forged]),
			() => (state.scriptKeyOf = () => "forged"),
			() => delete state.scriptKeyOf,
			() => (state.scripts = null),
			() => delete state.scripts,
			() => state.scripts?.hashes?.(url)?.push?.(forged),
			() => state.scripts?.release?.(instanceID),
			() => recorded(url).push(forged)
		];
		for (const attempt of attempts) {
			try {
				attempt();
			} catch {
				// A refusal is as good as nothing changed.
			}
		}
		expect(recorded(url)).toEqual([sha256("export const v = 1;\n")]);
		releaseInstanceScope(instanceID);
		expect(recorded(url)).toEqual([]);
	});

	it("a package's file under node_modules is not recorded", () => {
		const load = loadHook();
		const url = freshURL("node_modules/pkg/index.cjs");
		load(url, {}, () => ({ format: "commonjs", source: "module.exports = 2;\n" }));
		expect(recorded(url)).toEqual([]);
	});

	it.runIf(typeof stripTypeScriptTypes === "function")(
		"a TypeScript CommonJS source is recorded as Node compiles it, its types stripped",
		() => {
			const load = loadHook();
			const url = freshURL("typed.cts");
			const source = "const answer: number = 3;\nmodule.exports = answer;\n";
			load(url, {}, () => ({ format: "commonjs-typescript", source }));
			expect(recorded(url)).toEqual([sha256(stripTypeScriptTypes(source))]);
		}
	);
});

describe("Frame placement > scripts learned from a shut-down instance are released (#597)", () => {
	it.runIf(HAS_SCRIPT_HASH)("create, call and shut down again and again keeps the learned scripts flat", async () => {
		const [{ config }] = getMatrixConfigs();
		/** One cycle: build, run a call that is checked for supplied code, shut down. */
		const cycle = async () => {
			const api = await slothlet({ ...config, base: path.join(DIR, "base"), permissions: { defaultPolicy: "allow", rules: [] } });
			await api.slothlet.api.add("callee", path.join(DIR, "callee"), { moduleID: "callee-mod" });
			await api.slothlet.api.add("supplier", path.join(DIR, "supplier"), { moduleID: "supplier-mod" });
			expect(await api.supplier.probe.throughCallee()).toBe("pong");
			await api.shutdown();
		};
		for (let index = 0; index < 2; index++) await cycle();
		const settled = learnedScriptCount();
		for (let index = 0; index < 5; index++) await cycle();
		expect(learnedScriptCount()).toBe(settled);
	});
});
