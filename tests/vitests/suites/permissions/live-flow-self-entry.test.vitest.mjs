/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/live-flow-self-entry.test.vitest.mjs
 *	@Date: 2026-11-17T11:15:03-08:00 (1794942903)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T11:24:41-08:00 (1794943481)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code that enters another flow by itself through an async resource, in the live runtime.
 *
 * @description
 * The live runtime pins what an `AsyncResource`, a function `AsyncLocalStorage.snapshot()` made and a bound function
 * run to the call or load that made them. Whoever holds the resource chooses the code it runs, so a module holding
 * another request's resource (or a snapshot a file made while it loaded) could run its own code there and read that
 * request's context, act as that module, and (with `permissions.caller.provenance` off, or without the permission
 * system) write as it. The code of the module that made the resource keeps the pin; anyone else's code runs as the code
 * that used the resource, as though nothing had been pinned. The runner slothlet hands Node's `runInAsyncScope` runs
 * nothing but the function it was given, and the registry the boundary patches share cannot switch them off.
 *
 * A child process runs each configuration, with Node's default async context and, where the Node running the suite has
 * the switch, with `AsyncContextFrame` off.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "live-flow-self-entry");
const PROBE = path.join(ROOT, "probe.mjs");

/**
 * Write a fixture file, creating its folder.
 * @param {string} file - Path below the fixture root.
 * @param {string[]} lines - File contents, one line each.
 * @returns {void}
 */
function write(file, lines) {
	const target = path.join(ROOT, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/secret/secret.mjs", ["export function read() {", '\treturn "secret";', "}"]);
	write("api/admin/admin.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		'import { AsyncResource, AsyncLocalStorage } from "node:async_hooks";',
		"// Holds a call of the first request open, leaving async resources of its flow where other modules can reach them.",
		"export async function work(hold) {",
		"\tconst shared = globalThis.__liveFlowSelfEntry;",
		'\tshared.resource = new AsyncResource("admin");',
		"\tshared.snapshot = AsyncLocalStorage.snapshot();",
		"\tshared.adminRead = () => ({ user: context.user ?? null });",
		"\tshared.adminBound = AsyncLocalStorage.bind(() => ({ user: context.user ?? null }));",
		"\tawait hold;",
		"\treturn { user: context.user ?? null, token: context.token ?? null };",
		"}"
	]);
	write("api/loader/loader.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		'import { AsyncResource, AsyncLocalStorage } from "node:async_hooks";',
		"// Made while the file loads: pinned to the load.",
		'globalThis.__liveFlowSelfEntryLoad = { resource: new AsyncResource("load"), snapshot: AsyncLocalStorage.snapshot() };',
		"globalThis.__liveFlowSelfEntryLoad.own = () => {",
		"\tlet me;",
		"\ttry {",
		"\t\tconst found = self.slothlet.metadata.self();",
		'\t\tme = found ? (found.apiPath ?? (Array.isArray(found.path) ? found.path.join(".") : null)) : null;',
		"\t} catch (error) {",
		"\t\tme = error?.code ?? String(error);",
		"\t}",
		"\treturn { user: context.user ?? null, self: me };",
		"};",
		"export function noop() {",
		"\treturn 1;",
		"}"
	]);
	write("evil/evil.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		'import { AsyncResource } from "node:async_hooks";',
		"const shared = () => globalThis.__liveFlowSelfEntry;",
		"const loaded = () => globalThis.__liveFlowSelfEntryLoad;",
		"const codeOf = (error) => error?.code ?? String(error);",
		"function probe() {",
		"\tconst out = { user: context.user ?? null };",
		"\ttry {",
		"\t\tconst me = self.slothlet.metadata.self();",
		'\t\tout.self = me ? (me.apiPath ?? (Array.isArray(me.path) ? me.path.join(".") : null)) : null;',
		"\t} catch (error) {",
		"\t\tout.self = codeOf(error);",
		"\t}",
		"\ttry {",
		"\t\tout.secret = self.secret.read();",
		"\t} catch (error) {",
		"\t\tout.secret = codeOf(error);",
		"\t}",
		"\ttry {",
		'\t\tself.secret.planted = () => "planted";',
		'\t\tout.write = "ok";',
		"\t} catch (error) {",
		"\t\tout.write = codeOf(error);",
		"\t}",
		"\treturn out;",
		"}",
		"export function own() {",
		"\treturn probe();",
		"}",
		"export function resource() {",
		"\treturn shared().resource.runInAsyncScope(probe);",
		"}",
		"export function resourceAwait() {",
		"\treturn shared().resource.runInAsyncScope(async () => {",
		"\t\tawait null;",
		"\t\treturn probe();",
		"\t});",
		"}",
		"export function snapshot() {",
		"\treturn shared().snapshot(probe);",
		"}",
		"export function bound() {",
		"\treturn shared().resource.bind(probe)();",
		"}",
		"// The call's own function, run through its resource (as a pool runs a requester's callback).",
		"export function adminCode() {",
		"\treturn shared().resource.runInAsyncScope(shared().adminRead);",
		"}",
		"export function adminBound() {",
		"\treturn shared().adminBound();",
		"}",
		"export function loadResource() {",
		"\treturn loaded().resource.runInAsyncScope(probe);",
		"}",
		"export function loadSnapshot() {",
		"\treturn loaded().snapshot(probe);",
		"}",
		"export function loadOwn() {",
		"\treturn loaded().resource.runInAsyncScope(loaded().own);",
		"}",
		"export function hostResource() {",
		"\treturn shared().hostResource.runInAsyncScope(probe);",
		"}",
		"export function hostSnapshot() {",
		"\treturn shared().hostSnapshot(probe);",
		"}",
		"// Takes the runner slothlet hands Node's runInAsyncScope (replaced on the base class's prototype) and runs its own code with it.",
		"export function stealRunner() {",
		"\tconst own = Object.getPrototypeOf(AsyncResource.prototype);",
		"\tconst Base = own === Object.prototype ? AsyncResource.prototype : own;",
		"\tconst original = Base.runInAsyncScope;",
		"\tlet stolen = null;",
		"\tBase.runInAsyncScope = function (fn, thisArg, ...args) {",
		'\t\tif (stolen === null && typeof fn === "function") stolen = fn;',
		"\t\treturn Reflect.apply(original, this, [fn, thisArg, ...args]);",
		"\t};",
		"\ttry {",
		"\t\tshared().resource.runInAsyncScope(shared().adminRead);",
		"\t\tshared().snapshot(shared().adminRead);",
		"\t} finally {",
		"\t\tBase.runInAsyncScope = original;",
		"\t}",
		"\tif (!stolen) return { stolen: false };",
		"\ttry {",
		"\t\treturn { stolen: true, ...stolen(probe, undefined, []) };",
		"\t} catch (error) {",
		"\t\treturn { stolen: true, error: codeOf(error) };",
		"\t}",
		"}",
		"// Tries to switch the boundary patches off through the registry their layers share.",
		"export function tamper() {",
		'\tconst key = Symbol.for("slothlet.boundaryPatch.layers");',
		"\tconst out = {};",
		"\tconst registry = globalThis[key];",
		"\ttry {",
		"\t\tglobalThis[key] = new WeakMap();",
		"\t} catch {}",
		"\ttry {",
		"\t\tdelete globalThis[key];",
		"\t} catch {}",
		"\tout.registryKept = globalThis[key] === registry;",
		'\tconst hooks = process.getBuiltinModule("node:async_hooks");',
		"\tfor (const marker of [hooks.AsyncLocalStorage.snapshot, hooks.AsyncLocalStorage.bind, hooks.AsyncResource]) {",
		"\t\tconst layer = registry?.get(marker);",
		"\t\tif (!layer) continue;",
		"\t\ttry {",
		"\t\t\tlayer.active = false;",
		"\t\t} catch {}",
		"\t\ttry {",
		"\t\t\tregistry.set(marker, { active: false, below: layer.below });",
		"\t\t} catch {}",
		"\t}",
		"\tout.after = shared().resource.runInAsyncScope(shared().adminRead);",
		"\treturn out;",
		"}"
	]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		'import { AsyncResource, AsyncLocalStorage } from "node:async_hooks";',
		"const [mode, provenance, attribution] = process.argv.slice(2);",
		'const root = new URL(".", import.meta.url).pathname;',
		"const tick = () => new Promise((resolve) => setTimeout(resolve, 5));",
		"const codeOf = (error) => error?.code ?? String(error);",
		"async function make() {",
		'\tconst config = { base: root + "api", silent: true, runtime: "live", context: { app: "demo" } };',
		'\tif (mode !== "none") {',
		"\t\tconfig.permissions = { mode };",
		'\t\tif (mode === "on") {',
		"\t\t\tconfig.permissions.rules = [",
		'\t\t\t\t{ caller: "evil.**", target: "secret.**", effect: "deny" },',
		'\t\t\t\t{ caller: "evil.**", target: "secret.**", effect: "allow", condition: { user: "root" } }',
		"\t\t\t];",
		'\t\t\tconfig.permissions.caller = { provenance: provenance !== "noprovenance", attribution };',
		"\t\t}",
		"\t}",
		"\tglobalThis.__liveFlowSelfEntry = {};",
		"\tconst api = await slothlet(config);",
		'\tawait api.slothlet.api.add("evil", root + "evil", { id: "evil" });',
		"\treturn api;",
		"}",
		"const out = {};",
		"// One request (root) holds admin's call open while another (mallory) runs evil.",
		'const routes = ["own", "resource", "resourceAwait", "snapshot", "bound", "adminCode", "adminBound", "loadResource", "loadSnapshot", "loadOwn", "stealRunner", "tamper"];',
		"for (const route of routes) {",
		"\tconst api = await make();",
		"\tlet release;",
		"\tconst hold = new Promise((resolve) => (release = resolve));",
		'\tconst first = api.slothlet.context.run({ user: "root", token: "T-root" }, () => api.admin.work(hold));',
		"\tawait tick();",
		"\ttry {",
		'\t\tout[route] = await api.slothlet.context.run({ user: "mallory" }, () => api.evil[route]());',
		"\t} catch (error) {",
		"\t\tout[route] = codeOf(error);",
		"\t}",
		"\trelease();",
		'\tout[route + ":first"] = await first;',
		'\tout[route + ":planted"] = typeof api.secret.planted;',
		"\tawait api.slothlet.shutdown();",
		"}",
		"// A run() the host opened, entered by evil through what the host made there while a call of it waits.",
		'for (const route of ["hostResource", "hostSnapshot"]) {',
		"\tconst api = await make();",
		"\tconst shared = globalThis.__liveFlowSelfEntry;",
		"\tlet release;",
		"\tconst hold = new Promise((resolve) => (release = resolve));",
		'\tconst first = api.slothlet.context.run({ user: "root" }, () => {',
		'\t\tshared.hostResource = new AsyncResource("host");',
		"\t\tshared.hostSnapshot = AsyncLocalStorage.snapshot();",
		"\t\treturn api.admin.work(hold);",
		"\t});",
		"\tawait tick();",
		"\ttry {",
		'\t\tout[route] = await api.slothlet.context.run({ user: "mallory" }, () => api.evil[route]());',
		"\t} catch (error) {",
		"\t\tout[route] = codeOf(error);",
		"\t}",
		'\tout[route + ":host"] = shared.hostResource.runInAsyncScope(() => api.slothlet.context.get("user"));',
		"\trelease();",
		"\tawait first;",
		"\tawait api.slothlet.shutdown();",
		"}",
		"console.log(JSON.stringify(out));"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process.
 * @param {string[]} nodeFlags - Flags for Node.
 * @param {string} mode - The permission mode, or "none" for no permissions config.
 * @param {string} provenance - "noprovenance" to turn `permissions.caller.provenance` off.
 * @param {string} attribution - `permissions.caller.attribution`.
 * @returns {Record<string, *>} What each route saw.
 */
function probe(nodeFlags, mode, provenance = "provenance", attribution = "precise") {
	const result = spawnSync(process.execPath, [...nodeFlags, "--conditions=slothlet-dev", PROBE, mode, provenance, attribution], {
		cwd: process.cwd(),
		env: process.env,
		encoding: "utf8",
		timeout: 120000
	});
	if (result.status !== 0) throw new Error(`probe failed (${result.status}): ${result.stderr}`);
	return JSON.parse(result.stdout.trim().split("\n").pop());
}

// Node 24 and later switch AsyncContextFrame off with this flag; Node 22 runs without it by default.
const FRAMES = process.allowedNodeEnvironmentFlags.has("--no-async-context-frame")
	? [
			["default async context", []],
			["AsyncContextFrame off", ["--no-async-context-frame"]]
		]
	: [["default async context", []]];

const CONFIGS = [
	["no permissions config", "none", "provenance", "precise"],
	["permissions off", "off", "provenance", "precise"],
	["permissions on", "on", "provenance", "precise"],
	["permissions on, attribution fast", "on", "provenance", "fast"],
	["permissions on, provenance off", "on", "noprovenance", "precise"],
	["permissions on, provenance off, attribution fast", "on", "noprovenance", "fast"]
];

// Another request's resource, snapshot and bound function, and a resource and a snapshot a file made while it loaded.
const SELF_ENTRY_ROUTES = ["resource", "resourceAwait", "snapshot", "bound", "loadResource", "loadSnapshot"];

describe.each(FRAMES)("Permissions > live runtime > a flow entered by module code itself > %s", (_label, nodeFlags) => {
	describe.each(CONFIGS)("%s", (_name, mode, provenance, attribution) => {
		const checks = mode === "on";
		let result;

		beforeAll(() => {
			result = probe(nodeFlags, mode, provenance, attribution);
		});

		it("the module's own call sees its own request (reference)", () => {
			expect(result.own).toEqual({
				user: "mallory",
				self: "evil.own",
				secret: checks ? "PERMISSION_DENIED" : "secret",
				write: checks ? "LOOSE_SET_NOT_OWNED" : "ok"
			});
		});

		it.each(SELF_ENTRY_ROUTES)("its own code run through %s runs as its own call, not as the resource's maker", (route) => {
			expect(result[route]).toEqual({ ...result.own, self: `evil.${route}` });
			expect(result[route + ":planted"]).toBe(result["own:planted"]);
		});

		it("the other request's own call still sees its own context", () => {
			for (const route of [...SELF_ENTRY_ROUTES, "own", "adminCode", "adminBound"])
				expect(result[route + ":first"]).toEqual({ user: "root", token: "T-root" });
		});

		it("the other call's own function, run through its resource or bound by it, still sees its request", () => {
			expect(result.adminCode).toEqual({ user: "root" });
			expect(result.adminBound).toEqual({ user: "root" });
		});

		it("the loading file's own function, run through the resource it made while loading, still runs as its module", () => {
			expect(result.loadOwn.self).toBe("loader");
		});

		it.each(["hostResource", "hostSnapshot"])(
			"its own code entering a run() the host opened through the host's %s runs as its call",
			(route) => {
				expect(result[route]).toEqual({ ...result.own, self: `evil.${route}` });
				expect(result[route + ":host"]).toBe("root");
			}
		);

		it("the runner handed to Node's runInAsyncScope runs nothing it was not given as the resource's maker", () => {
			expect(result.stealRunner).toMatchObject({ stolen: true, user: "mallory", self: "evil.stealRunner" });
		});

		it("the registry the boundary patches share can neither be replaced nor used to switch them off", () => {
			expect(result.tamper).toEqual({ registryKept: true, after: { user: "root" } });
		});
	});
});
