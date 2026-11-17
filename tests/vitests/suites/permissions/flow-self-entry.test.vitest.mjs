/**
 * @fileoverview Module code that enters another flow by itself keeps its own context and identity.
 *
 * @description
 * Under the async runtime a call's flow carries its context and identity in an `AsyncLocalStorage` store, and Node hands
 * that store to any code holding an async resource of the flow: an `AsyncResource` (its `runInAsyncScope()` and
 * `bind()`), a function `AsyncLocalStorage.snapshot()` made there, or the context a timer keeps under a symbol, copied
 * onto a timer of the code's own. A module holding such a resource of another request's flow, or of a `run()` the host
 * opened, could run its own code there and act with that flow's context and identity: read the other request's
 * context, pass a rule whose `condition` matches that context, report another module in `metadata.self()`, and, with
 * `permissions.caller.provenance` off, act with the host's rights.
 *
 * Code that enters a flow by itself acts outside it: as the leaf it is, with the instance's own context. Code the flow
 * runs keeps it: the call's own code after an `await`, another module's function the call (or the host) calls, and
 * the call's own function run in its flow by a module holding the call's resource.
 *
 * A child process runs each configuration, with Node's default async context and, where the Node running the suite has
 * the switch, with `AsyncContextFrame` off.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "flow-self-entry");
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
	// A module whose call, made in the first request, leaves async resources of its flow where others can reach them.
	write("api/admin/admin.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		'import { AsyncResource, AsyncLocalStorage } from "node:async_hooks";',
		"export async function work(hold) {",
		"\tconst shared = globalThis.__flowSelfEntry;",
		'\tshared.resource = new AsyncResource("admin");',
		"\tshared.snapshot = AsyncLocalStorage.snapshot();",
		"\tshared.timer = setTimeout(() => {}, 60000);",
		"\tshared.adminRead = () => ({ user: context.user ?? null });",
		"\tawait hold;",
		"\tclearTimeout(shared.timer);",
		"\treturn { user: context.user ?? null };",
		"}",
		"// Runs a function another module left on globalThis, after an await, in this call's flow.",
		"export async function runPlanted() {",
		"\tawait null;",
		"\treturn globalThis.__flowSelfEntry.evilProbe();",
		"}"
	]);
	write("evil/evil.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		'import { AsyncResource } from "node:async_hooks";',
		"const shared = () => globalThis.__flowSelfEntry;",
		"const codeOf = (error) => error?.code ?? String(error);",
		"function probe() {",
		"\tconst out = {};",
		"\tout.user = context.user ?? null;",
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
		"\treturn out;",
		"}",
		"// What the module's code tries once it runs in a flow the host opened.",
		"function attempt() {",
		"\tconst out = { user: context.user ?? null };",
		"\ttry {",
		'\t\tself.slothlet.permissions.control.mode("off");',
		'\t\tout.control = "ok";',
		"\t} catch (error) {",
		"\t\tout.control = codeOf(error);",
		"\t}",
		"\ttry {",
		'\t\tself.secret.planted = () => "planted";',
		'\t\tout.write = "ok";',
		"\t} catch (error) {",
		"\t\tout.write = codeOf(error);",
		"\t}",
		"\treturn out;",
		"}",
		"// A timer of the module's own, given the async context Node keeps on another flow's timer.",
		"function adopt(from, fn) {",
		"\treturn new Promise((resolve) => {",
		"\t\tconst mine = setTimeout(() => resolve(fn()), 5);",
		"\t\tfor (const key of Object.getOwnPropertySymbols(from)) {",
		"\t\t\tif (/store|frame|context/i.test(String(key))) mine[key] = from[key];",
		"\t\t}",
		"\t});",
		"}",
		"export function plant() {",
		"\tshared().evilProbe = probe;",
		"\tshared().evilAttempt = attempt;",
		"\treturn true;",
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
		"export function timer() {",
		"\treturn adopt(shared().timer, probe);",
		"}",
		"// The call's own function, run in its flow through the call's resource (as a pool runs a requester's callback).",
		"export function adminCode() {",
		"\treturn shared().resource.runInAsyncScope(shared().adminRead);",
		"}",
		"export function hostResource() {",
		"\treturn shared().hostResource.runInAsyncScope(attempt);",
		"}",
		"export function hostSnapshot() {",
		"\treturn shared().hostSnapshot(attempt);",
		"}",
		"export function hostTimer() {",
		"\treturn adopt(shared().hostTimer, attempt);",
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
		'\tconst config = { base: root + "api", silent: true, context: { app: "demo" } };',
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
		"\tconst api = await slothlet(config);",
		'\tawait api.slothlet.api.add("evil", root + "evil", { id: "evil" });',
		"\tglobalThis.__flowSelfEntry = {};",
		"\tawait api.evil.plant();",
		"\treturn api;",
		"}",
		"const out = {};",
		"// One request (root) holds admin's call open while another (mallory) runs evil.",
		'for (const route of ["own", "resource", "resourceAwait", "snapshot", "bound", "timer", "adminCode"]) {',
		"\tconst api = await make();",
		"\tlet release;",
		"\tconst hold = new Promise((resolve) => (release = resolve));",
		'\tconst first = api.slothlet.context.run({ user: "root" }, () => api.admin.work(hold));',
		"\tawait tick();",
		"\ttry {",
		'\t\tout[route] = await api.slothlet.context.run({ user: "mallory" }, () => api.evil[route]());',
		"\t} catch (error) {",
		"\t\tout[route] = codeOf(error);",
		"\t}",
		"\trelease();",
		"\tout[route + ':first'] = await first;",
		"\tawait api.slothlet.shutdown();",
		"}",
		"// The first request's call runs evil's function itself, after an await.",
		"{",
		"\tconst api = await make();",
		"\ttry {",
		'\t\tout.adminRunsPlanted = await api.slothlet.context.run({ user: "root" }, () => api.admin.runPlanted());',
		"\t} catch (error) {",
		"\t\tout.adminRunsPlanted = codeOf(error);",
		"\t}",
		"\tawait api.slothlet.shutdown();",
		"}",
		"// A flow the host opened: the host runs evil's function itself, synchronously and after an await.",
		'for (const route of ["hostCalls", "hostCallsAfterAwait"]) {',
		"\tconst api = await make();",
		"\tconst attempt = globalThis.__flowSelfEntry.evilAttempt;",
		"\ttry {",
		'\t\tout[route] = await api.slothlet.context.run({ user: "root" }, async () => {',
		'\t\t\tif (route === "hostCallsAfterAwait") await null;',
		"\t\t\treturn attempt();",
		"\t\t});",
		"\t} catch (error) {",
		"\t\tout[route] = codeOf(error);",
		"\t}",
		'\tout[route + ":mode"] = mode === "none" ? null : api.slothlet.permissions.control.mode();',
		"\tawait api.slothlet.shutdown();",
		"}",
		"// A flow the host opened, entered by evil itself through what the host made there.",
		'for (const route of ["hostResource", "hostSnapshot", "hostTimer"]) {',
		"\tconst api = await make();",
		"\tconst shared = globalThis.__flowSelfEntry;",
		'\tawait api.slothlet.context.run({ user: "root" }, () => {',
		'\t\tshared.hostResource = new AsyncResource("host");',
		"\t\tshared.hostSnapshot = AsyncLocalStorage.snapshot();",
		"\t\tshared.hostTimer = setTimeout(() => {}, 60000);",
		"\t});",
		"\ttry {",
		'\t\tout[route] = await api.slothlet.context.run({ user: "mallory" }, () => api.evil[route]());',
		"\t} catch (error) {",
		"\t\tout[route] = codeOf(error);",
		"\t}",
		"\tclearTimeout(shared.hostTimer);",
		'\tout[route + ":mode"] = mode === "none" ? null : api.slothlet.permissions.control.mode();',
		'\tout[route + ":planted"] = typeof api.secret.planted;',
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

const SELF_ENTRY_ROUTES = ["resource", "resourceAwait", "snapshot", "bound", "timer"];

describe.each(FRAMES)("Permissions > a flow entered by module code itself > %s", (_label, nodeFlags) => {
	describe.each(CONFIGS)("%s", (_name, mode, provenance, attribution) => {
		const checks = mode === "on";
		const noProvenance = provenance === "noprovenance";
		let result;

		beforeAll(() => {
			result = probe(nodeFlags, mode, provenance, attribution);
		});

		it("the module's own call sees its own request (reference)", () => {
			expect(result.own).toEqual({ user: "mallory", self: "evil.own", secret: checks ? "PERMISSION_DENIED" : "secret" });
		});

		it.each(SELF_ENTRY_ROUTES)("its own code run through another request's %s sees neither that request nor its call", (route) => {
			expect(result[route].user).toBeNull();
			expect(result[route].self).toMatch(/^evil(\.|$)/);
			expect(result[route].secret).toBe(checks ? "PERMISSION_DENIED" : "secret");
		});

		it("the other request's own call still sees its own context after the await", () => {
			for (const route of [...SELF_ENTRY_ROUTES, "own", "adminCode"]) expect(result[route + ":first"]).toEqual({ user: "root" });
		});

		it("the other call's own function, run through its resource, still sees its request", () => {
			expect(result.adminCode).toEqual({ user: "root" });
		});

		it("a module's function the other call runs itself still runs in that call's request", () => {
			expect(result.adminRunsPlanted.user).toBe("root");
			// With provenance on its frames tell it is the module's code (run under the call as its ceiling); otherwise it
			// runs as the call that runs it.
			expect(result.adminRunsPlanted.self).toBe(checks && !noProvenance ? "evil" : "admin.runPlanted");
		});

		it("a module's function the host runs inside run() sees the host's request", () => {
			for (const route of ["hostCalls", "hostCallsAfterAwait"]) expect(result[route].user).toBe("root");
		});

		if (checks && noProvenance) {
			it("with provenance off, a module's function the host runs inside run() still has the host's rights (as documented)", () => {
				// The documented trade-off of `provenance: false`: code a host flow runs runs with the host's permissions.
				expect(result.hostCalls).toMatchObject({ control: "ok", write: "ok" });
				expect(result["hostCalls:mode"]).toBe("off");
				expect(result.hostCallsAfterAwait).toMatchObject({ control: "ok", write: "ok" });
				expect(result["hostCallsAfterAwait:mode"]).toBe("off");
			});
		}

		it.each(["hostResource", "hostSnapshot", "hostTimer"])(
			"its own code entering a run() the host opened through the host's %s gets neither the run's context nor the host's rights",
			(route) => {
				expect(result[route].user).toBeNull();
				if (checks) {
					expect(result[route].control).toBe("PERMISSION_DENIED");
					expect(result[route].write).not.toBe("ok");
					expect(result[route + ":mode"]).toBe("on");
					expect(result[route + ":planted"]).toBe("undefined");
				}
			}
		);
	});
});
