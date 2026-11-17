/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/flow-self-entry.test.vitest.mjs
 *	@Date: 2026-11-17T08:04:12-08:00 (1794931452)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T08:41:56-08:00 (1794933716)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

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
	// A module whose call hands out a function that reads the context it runs in.
	write("api/mod/mod.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		"const reader = function reader(tag) {",
		"\tconst seen = [context.user ?? null, this?.mark ?? null];",
		"\tglobalThis.__flowSelfEntry.seen[tag] = seen;",
		"\treturn seen;",
		"};",
		"export function getReader() {",
		"\treturn reader;",
		"}",
		"export function isOwn(fn) {",
		"\treturn fn === reader;",
		"}"
	]);
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
		"}",
		"// The reader another module hands out, read by its own code inside a run() it entered by itself, handed to Node.",
		"function handReader(tag) {",
		"\treturn new Promise((resolve) => {",
		"\t\tPromise.resolve(tag).then(self.mod.getReader()).then(resolve);",
		"\t});",
		"}",
		"export function hostResourceReader() {",
		'\treturn shared().hostResource.runInAsyncScope(() => handReader("evilResource"));',
		"}",
		"export function hostTimerReader() {",
		'\treturn adopt(shared().hostTimer, () => handReader("evilTimer"));',
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
		"// A function a call hands the run's own code, handed to Node to call later.",
		"{",
		"\tconst api = await make();",
		"\tconst shared = globalThis.__flowSelfEntry;",
		"\tshared.seen = {};",
		"\tconst outside = api.mod.getReader();",
		"\tout.readerOutsideSame = outside === api.mod.getReader();",
		'\tawait api.slothlet.context.run({ user: "root" }, async () => {',
		"\t\tconst reader = api.mod.getReader();",
		"\t\tout.readerInRunSame = reader === api.mod.getReader();",
		"\t\tout.readerInRunShape = [typeof reader, reader.name, reader.length];",
		"\t\tout.readerHandedBackIsOwn = api.mod.isOwn(reader);",
		'\t\tawait Promise.resolve("then").then(reader);',
		'\t\tsetTimeout(reader, 0, "timeout");',
		"\t\tawait tick();",
		"\t\tawait null;",
		'\t\tawait Promise.resolve("thenAfterAwait").then(reader);',
		'\t\tawait Promise.resolve("thenThis").then(reader.bind({ mark: "bound" }));',
		'\t\tReflect.apply(reader, { mark: "this" }, ["direct"]);',
		"\t});",
		'\toutside("outside");',
		"\tout.readerSeen = shared.seen;",
		"\tawait api.slothlet.shutdown();",
		"}",
		"// The same function read by a module's own code that entered a run() the host opened by itself.",
		'for (const route of ["hostResourceReader", "hostTimerReader"]) {',
		"\tconst api = await make();",
		"\tconst shared = globalThis.__flowSelfEntry;",
		"\tshared.seen = {};",
		'\tawait api.slothlet.context.run({ user: "root" }, () => {',
		'\t\tshared.hostResource = new AsyncResource("host");',
		"\t\tshared.hostTimer = setTimeout(() => {}, 60000);",
		"\t});",
		"\ttry {",
		'\t\tout[route] = await api.slothlet.context.run({ user: "mallory" }, () => api.evil[route]());',
		"\t} catch (error) {",
		"\t\tout[route] = codeOf(error);",
		"\t}",
		"\tclearTimeout(shared.hostTimer);",
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

		it("a function a call hands the run's own code keeps the run when Node calls it later", () => {
			expect(result.readerSeen.then).toEqual(["root", null]);
			expect(result.readerSeen.timeout).toEqual(["root", null]);
			expect(result.readerSeen.thenAfterAwait).toEqual(["root", null]);
			expect(result.readerSeen.thenThis).toEqual(["root", "bound"]);
			expect(result.readerSeen.direct).toEqual(["root", "this"]);
			expect(result.readerInRunShape).toEqual(["function", "reader", 1]);
		});

		it("the same function read twice in one run is the same value, and outside every run it is the function itself", () => {
			expect(result.readerInRunSame).toBe(true);
			expect(result.readerOutsideSame).toBe(true);
			expect(result.readerHandedBackIsOwn).toBe(true);
			expect(result.readerSeen.outside).toEqual([null, null]);
		});

		// Where functions are bound to the run they are read in (every setting but "precise" with the permission system on,
		// whose stand-ins are its module's calls), code that entered the run by itself is not handed one.
		if (!(checks && attribution === "precise")) {
			it.each(["hostResourceReader", "hostTimerReader"])(
				"the function read by a module's own code that entered a run() by itself through the host's %s is not bound to the run",
				(route) => {
					expect(result[route][0]).toBeNull();
				}
			);
		}
	});
});
