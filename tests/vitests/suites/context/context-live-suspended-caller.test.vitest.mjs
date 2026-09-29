/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-suspended-caller.test.vitest.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Live-runtime caller attribution while two or more module calls are suspended (#512).
 *
 * @description
 * The live runtime keeps caller identity in one field per store. Once two module calls are
 * suspended at the same time that field cannot say which of them is running, so the caller is read
 * off the call stack. V8's async stack traces also carry the `at async …` frames of the OUTER
 * suspended calls, which is what these cases are about:
 *
 * - **A synchronously entered module** — a nested leaf, or a `lockCaller`-pinned callback — whose
 *   own file is not a suspended call's was attributed to the outer suspended caller found further
 *   down the stack (`run.boot` here, `run.runHostBootChain` downstream).
 * - **A suspended call resuming in a sibling file of its module** was matched only by the exact
 *   file it entered through, so it too fell through to the outer suspended caller.
 *
 * Both denied an extension its own leaves. The fixes must not open anything up, so the same suite
 * pins the cases where a wrong answer would ELEVATE: a finished caller left behind in the field by
 * an out-of-order settle, a leaf that started a privileged call and keeps running while that call is
 * suspended, and a function whose NAME carries another module's path. Two concurrent calls resuming
 * interleaved must still each be attributed to themselves, and a stack that cannot tell two api
 * paths of one module apart must fail closed.
 *
 * Fixture (`api_tests/api_test_live_suspended_caller`): the base holds the host's `run.*` and
 * `registry.*`; `ext/api` is mounted as `ext` (the extension, with its per-entity `activate`
 * routine), `rogue/api` as `rogue` (a module permitted nothing on the extension). `run.*` may drive
 * the extension's routine and entry but not its views; only `run.kick`/`run.quick` are privileged.
 *
 * @module tests/vitests/suites/context/context-live-suspended-caller
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { LiveContextManager, parseStackFrame, toComparablePath } from "#handlers/context-live";
import { getMatrixConfigs, getBrowserMatrixConfigs, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../api_tests/api_test_live_suspended_caller");
const EXT_DIR = `${ROOT}/ext/api`;
const ROGUE_DIR = `${ROOT}/rogue/api`;

const RULES = [
	// The extension may reach all of its own leaves, and the host registry.
	{ caller: "ext.**", target: "ext.**", effect: "allow" },
	{ caller: "ext.**", target: "registry.**", effect: "allow" },
	{ caller: "ext.**", target: "slothlet.permissions.**", effect: "allow" },
	// The host's boot leaves may drive each other, the registry, and the extension's routine and entry
	// — never its views or caches.
	{ caller: "run.**", target: "run.**", effect: "allow" },
	{ caller: "run.**", target: "registry.**", effect: "allow" },
	{ caller: "run.**", target: "ext.entry.**", effect: "allow" },
	// Two privileged host leaves, so a misattribution to them would be an elevation.
	{ caller: "run.{kick,quick}", target: "ext.views.**", effect: "allow" },
	{ caller: "rogue.**", target: "run.quick", effect: "allow" },
	// Entry points anyone may call. A call made while exactly one module call is suspended is
	// attributed to that call, so the suite's own driving calls must not depend on who that is.
	{ caller: "**", target: "run.{chain,idle,kick}", effect: "allow" },
	{ caller: "**", target: "rogue.**", effect: "allow" },
	{ caller: "**", target: "ext.activate", effect: "allow" },
	{ caller: "**", target: "ext.activate.**", effect: "allow" },
	{ caller: "**", target: "ext.entry.wait", effect: "allow" }
];

const PLATFORMS = [
	...getMatrixConfigs({ runtime: "live" }).map(({ name, config }) => ({ name: `node > ${name}`, config, browser: false })),
	...getBrowserMatrixConfigs().map(({ name, config }) => ({ name: `browser > ${name}`, config, browser: true }))
];

let MANIFEST;

beforeAll(async () => {
	MANIFEST = await getManifest(ROOT);
});

/**
 * A promise and the function that releases it.
 * @returns {[Promise<void>, Function]} Gate and release.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => (release = resolve));
	return [promise, release];
}

/**
 * Let every pending microtask and one timer turn run.
 * @returns {Promise<void>} Resolves on the next macrotask.
 */
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

describe.each(PLATFORMS)("Live runtime > suspended caller attribution (#512) > $name", ({ config, browser }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Boot the host with the extension and the rogue module mounted.
	 * @returns {Promise<{extID: string, rogueID: string}>} The mounted modules' ids.
	 */
	async function boot() {
		const base = browser ? makeBrowserConfig(config, ROOT, MANIFEST) : { ...config, base: ROOT };
		api = await slothlet({
			...base,
			hidden: ["ext", "rogue", "shared"],
			routines: [{ name: "activate", mode: "manual", cascade: false }],
			stackRoutines: true,
			silent: true,
			permissions: { defaultPolicy: "deny", rules: RULES }
		});
		const extID = await api.slothlet.api.add(["ext"], EXT_DIR);
		const rogueID = await api.slothlet.api.add(["rogue"], ROGUE_DIR);
		return { extID, rogueID };
	}

	describe("a synchronously entered module is attributed to itself, not to an outer suspended caller", () => {
		it("a lockCaller-pinned callback the host invokes from its boot chain runs as the extension", async () => {
			const { extID } = await boot();
			// run.chain → run.boot → ext.activate.for(id) registers two pinned callbacks and settles;
			// run.boot (still suspended inside run.chain) then renders them synchronously.
			expect(await api.run.chain("pinned", extID)).toEqual(["rendered:pinned", "subscribed"]);
		});

		it("a nested leaf entered from the boot chain runs as itself", async () => {
			const { extID } = await boot();
			expect(await api.run.chain("nested", extID)).toEqual(["rendered:nested", "subscribed"]);
		});

		it("control: the outer suspended caller reaching the extension's view itself is still denied", async () => {
			const { extID } = await boot();
			expect(await api.run.chain("direct", extID)).toBe("denied");
		});

		it("control: the outer suspended caller keeps the calls it is permitted to make", async () => {
			const { extID } = await boot();
			expect(await api.run.chain("own", extID)).toBe(0);
		});
	});

	describe("a suspended call resuming in a sibling file is attributed to its module", () => {
		it("an activation that resumes in a sibling file reaches the extension's own leaves", async () => {
			const { extID } = await boot();
			const [released, release] = gate();
			const pending = api.run.chain("sibling", extID, released);
			await turn();
			release();
			expect(await pending).toEqual(["rendered:sibling", "subscribed"]);
		});

		it("a frame of the entry file further out still resolves the call when a shared file is ambiguous", async () => {
			const { extID } = await boot();
			const [activationGate, releaseActivation] = gate();
			const [waitGate, releaseWait] = gate();
			const activation = api.ext.activate.for(extID)("awaited", activationGate);
			await turn();
			// A second api path of the same module in flight: the sibling file alone cannot tell them apart.
			const waiting = api.ext.entry.wait(waitGate);
			await turn();
			releaseActivation();
			expect(await activation).toEqual(["rendered:sibling", "subscribed"]);
			releaseWait();
			expect(await waiting).toBe("waited");
		});

		it("two api paths of one module resuming in a shared file with nothing to tell them apart fail closed", async () => {
			const { extID } = await boot();
			const [activationGate, releaseActivation] = gate();
			const [waitGate, releaseWait] = gate();
			const activation = api.ext.activate.for(extID)("sibling", activationGate);
			await turn();
			const waiting = api.ext.entry.wait(waitGate);
			await turn();
			releaseActivation();
			// ext.activate and ext.entry.wait may differ in rights; the stack names only their shared
			// module, so neither is chosen. With no caller, `self` itself refuses (reported through the
			// routine that ran the activation).
			await expect(activation).rejects.toMatchObject({ code: "ROUTINE_FAILED", cause: { code: "RUNTIME_NO_ACTIVE_CONTEXT_SELF" } });
			releaseWait();
			expect(await waiting).toBe("waited");
		});

		it("an outer caller of another module is not chosen when the resumed module cannot be told apart", async () => {
			const { extID } = await boot();
			const [activationGate, releaseActivation] = gate();
			const [waitGate, releaseWait] = gate();
			// run.chain → run.boot → ext.activate.for(id), resuming in the sibling file.
			const chained = api.run.chain("sibling", extID, activationGate);
			await turn();
			const waiting = api.ext.entry.wait(waitGate);
			await turn();
			releaseActivation();
			// The sibling file narrows the caller to ext.activate or ext.entry.wait; run.boot's frame
			// further out is the flow that awaited it, not a way to settle which of the two is running.
			await expect(chained).rejects.toMatchObject({ code: "ROUTINE_FAILED", cause: { code: "RUNTIME_NO_ACTIVE_CONTEXT_SELF" } });
			releaseWait();
			expect(await waiting).toBe("waited");
		});

		it("references taken before the await are refused too when the caller cannot be told apart", async () => {
			const { extID } = await boot();
			const [activationGate, releaseActivation] = gate();
			const [waitGate, releaseWait] = gate();
			const activation = api.ext.activate.for(extID)("siblingCaptured", activationGate);
			await turn();
			const waiting = api.ext.entry.wait(waitGate);
			await turn();
			releaseActivation();
			// Eager references are the leaves themselves, gated on whoever calls them — unresolved here, so
			// denied rather than handed the host exemption. A lazy reference to a not-yet-loaded leaf is a
			// pending value that carries the caller it was taken under (ext.activate), and is gated on that.
			// The permissions namespace is gated on the live caller in both modes.
			const expected = config.mode === "lazy" ? ["rendered:sibling", "subscribed", "denied"] : ["denied", "denied", "denied"];
			expect(await activation).toEqual(expected);
			releaseWait();
			expect(await waiting).toBe("waited");
		});
	});

	describe("concurrent calls stay attributed to themselves", () => {
		it.each([
			["extension released first", true],
			["rogue released first", false]
		])("two modules suspended together and resuming interleaved (%s)", async (_label, extensionFirst) => {
			const { extID } = await boot();
			const [extGate, releaseExt] = gate();
			const [rogueGate, releaseRogue] = gate();
			const extension = api.ext.activate.for(extID)("hold", extGate);
			await turn();
			const rogue = api.rogue.hold(rogueGate);
			await turn();

			// The host itself, while both are suspended: no module frame on the stack, so it is the host.
			expect(await api.ext.views.running.render("host")).toBe("rendered:host");

			if (extensionFirst) {
				releaseExt();
				expect(await extension).toBe("rendered:held");
				releaseRogue();
				expect(await rogue).toBe("denied");
			} else {
				releaseRogue();
				expect(await rogue).toBe("denied");
				releaseExt();
				expect(await extension).toBe("rendered:held");
			}
		});
	});

	describe("nothing is attributed to a caller that is not running (no elevation)", () => {
		it("a finished privileged caller left in the field by an out-of-order settle is not inherited (two suspended)", async () => {
			await boot();
			const [rogueGate, releaseRogue] = gate();
			const [idleGate, releaseIdle] = gate();
			const rogue = api.rogue.start(rogueGate);
			await turn();
			const idle = api.run.idle(idleGate);
			await turn();
			// run.kick (privileged, synchronous) starts run.quick and returns; run.quick settles after it
			// and restores the field to run.kick — which is by then neither running nor suspended.
			expect(await api.run.kick()).toBe("kicked");
			await turn();
			releaseRogue();
			// rogue.start resumes in its sibling worker file.
			expect(await rogue).toBe("denied");
			releaseIdle();
			expect(await idle).toBe("idle");
		});

		it("a finished privileged caller left in the field by an out-of-order settle is not inherited (one suspended)", async () => {
			await boot();
			const [rogueGate, releaseRogue] = gate();
			const rogue = api.rogue.start(rogueGate);
			await turn();
			expect(await api.run.kick()).toBe("kicked");
			await turn();
			releaseRogue();
			expect(await rogue).toBe("denied");
		});

		it("a leaf that starts a privileged call keeps its own identity while that call is suspended", async () => {
			await boot();
			expect(await api.rogue.fanout()).toBe("denied");
		});

		it("a function named after another module's source path is attributed by its location, not its name", async () => {
			const { extID } = await boot();
			const [extGate, releaseExt] = gate();
			const [forgeGate, releaseForge] = gate();
			const extension = api.ext.activate.for(extID)("hold", extGate);
			await turn();
			const forged = api.rogue.forge(forgeGate);
			await turn();
			releaseForge();
			expect(await forged).toBe("denied");
			releaseExt();
			expect(await extension).toBe("rendered:held");
		});
	});
});

describe.each(getMatrixConfigs({ runtime: "live" }))(
	"Live runtime > suspended caller attribution without a base directory (#512) > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		it("modules with no folder (no base, in-memory) own no frames; mounted modules still resolve", async () => {
			api = await slothlet({
				...config,
				base: null,
				routines: [{ name: "activate", mode: "manual", cascade: false }],
				stackRoutines: true,
				silent: true,
				permissions: { defaultPolicy: "deny", rules: RULES }
			});
			const extID = await api.slothlet.api.add(["ext"], EXT_DIR);
			await api.slothlet.api.add(["rogue"], ROGUE_DIR);
			await api.slothlet.api.add("memory", { exports: { ping: () => "pong" } });

			const [extGate, releaseExt] = gate();
			const [rogueGate, releaseRogue] = gate();
			const extension = api.ext.activate.for(extID)("hold", extGate);
			await turn();
			const rogue = api.rogue.start(rogueGate);
			await turn();
			releaseRogue();
			expect(await rogue).toBe("denied");
			releaseExt();
			expect(await extension).toBe("rendered:held");
		});
	}
);

describe("Live runtime > stack frame locations (#512)", () => {
	it("reads a V8 frame's location from its last balanced parenthesis group, ignoring the function name", () => {
		expect(parseStackFrame("    at run (file:///srv/app/api/run.mjs?slothlet_instance=a&module=b:4:9)")).toEqual({
			head: "at run ",
			path: "/srv/app/api/run.mjs"
		});
		// A computed-key method name carrying another file's path does not become the location.
		expect(parseStackFrame("    at /srv/app/ext/activate.mjs (file:///srv/app/rogue/forged.mjs:12:3)").path).toBe(
			"/srv/app/rogue/forged.mjs"
		);
		// A location with parentheses of its own stays whole.
		expect(parseStackFrame("    at f (C:/Program Files (x86)/app/api/run.mjs:1:2)").path).toBe("C:/Program Files (x86)/app/api/run.mjs");
	});

	it("reads a V8 frame without a function name, including an async one", () => {
		expect(parseStackFrame("    at file:///srv/app/api/run.mjs:4:9")).toEqual({ head: "", path: "/srv/app/api/run.mjs" });
		expect(parseStackFrame("    at async file:///srv/app/api/run.mjs:4:9").path).toBe("/srv/app/api/run.mjs");
	});

	it("reads a SpiderMonkey/JavaScriptCore frame after the last @ that starts a location", () => {
		expect(parseStackFrame("run@http://host/app/api/run.mjs:4:9")).toEqual({ head: "run", path: "http://host/app/api/run.mjs" });
		// A scoped package's @ inside the location is not mistaken for the separator.
		expect(parseStackFrame("run@/srv/app/node_modules/@scope/pkg/api/run.mjs:4:9").path).toBe(
			"/srv/app/node_modules/@scope/pkg/api/run.mjs"
		);
		expect(parseStackFrame("@file:///srv/app/api/run.mjs:4").path).toBe("/srv/app/api/run.mjs");
	});

	it("returns null for a line that is not a frame", () => {
		expect(parseStackFrame("Error: boom")).toBeNull();
		expect(parseStackFrame("    at broken (no-open-paren)) ")).toBeNull();
	});

	it("reduces paths and URLs to one comparable spelling", () => {
		expect(toComparablePath("file:///srv/app/api/x.mjs?slothlet_instance=a#h")).toBe("/srv/app/api/x.mjs");
		expect(toComparablePath("file:///srv/my%20app/api/x.mjs")).toBe("/srv/my app/api/x.mjs");
		expect(toComparablePath("file:///C:/app/api/x.mjs")).toBe("C:/app/api/x.mjs");
		expect(toComparablePath("C:\\app\\api\\")).toBe("C:/app/api");
		// A malformed escape is compared as spelled.
		expect(toComparablePath("file:///srv/app/100%/x.mjs")).toBe("/srv/app/100%/x.mjs");
		expect(toComparablePath("run/boot.mjs")).toBe("run/boot.mjs");
	});
});

describe("Live runtime > synchronous entries decide the caller (#512) [direct]", () => {
	// Direct instantiation: the entered stack is internal bookkeeping, and these shapes — a
	// context-only entry with no wrapper nested inside a module entry — are what the public paths
	// produce only incidentally.
	it("a context-only entry is looked through to the module entry around it", () => {
		const manager = new LiveContextManager();
		manager.initialize("direct-512");
		const outer = { ____slothletInternal: { apiPath: "outer.fn", filePath: "/x/outer.mjs", moduleID: "m" } };
		const seen = manager.runInContext(
			"direct-512",
			() => manager.runInContext("direct-512", () => manager.getCallerIdentity("direct-512"), null, []),
			null,
			[],
			outer
		);
		expect(seen.currentWrapper).toBe(outer);
		manager.cleanup("direct-512");
	});

	it("with no module entry and nothing suspended the store's baseline is the caller", () => {
		const manager = new LiveContextManager();
		manager.initialize("direct-512b");
		const seen = manager.runInContext("direct-512b", () => manager.getCallerIdentity("direct-512b"), null, []);
		expect(seen.currentWrapper).toBeNull();
		manager.cleanup("direct-512b");
	});
});
