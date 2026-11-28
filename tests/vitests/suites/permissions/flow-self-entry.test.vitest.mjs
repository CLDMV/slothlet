/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/flow-self-entry.test.vitest.mjs
 *	@Date: 2026-11-17T08:04:12-08:00 (1794931452)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:14-08:00 (1795869134)
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
 * the call's own function run in its flow by a module holding the call's resource. Context is isolated per run in
 * every permission mode (no `permissions` config, `"off"`, `"disabled"`, `"on"`, `"strict"`); only the permission
 * decisions depend on the mode.
 *
 * A child process runs each configuration, with Node's default async context and, where the Node running the suite has
 * the switch, with `AsyncContextFrame` off.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { jobHookCount } from "#handlers/context-async";

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
	// A module whose file, while it loads, leaves async resources of its load where others can reach them.
	write("api/loader/loader.mjs", [
		'import { AsyncResource, AsyncLocalStorage } from "node:async_hooks";',
		'globalThis.__flowSelfEntryLoad = { resource: new AsyncResource("load"), snapshot: AsyncLocalStorage.snapshot() };',
		"export function ping() {",
		"\treturn true;",
		"}"
	]);
	// A module whose call, made in the first request, leaves async resources of its flow where others can reach them.
	write("api/admin/admin.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		'import { AsyncResource, AsyncLocalStorage } from "node:async_hooks";',
		"// Hands `fn` to Node to run later, the way `how` names, without calling it itself.",
		"function schedule(how, fn) {",
		'\tif (how === "then") Promise.resolve().then(fn);',
		'\telse if (how === "timeout") setTimeout(fn, 0);',
		'\telse if (how === "immediate") setImmediate(fn);',
		'\telse if (how === "microtask") queueMicrotask(fn);',
		'\telse if (how === "tick") process.nextTick(fn);',
		'\telse if (how === "nested") new AsyncResource("inner").runInAsyncScope(() => Promise.resolve().then(fn));',
		"\telse throw new Error(how);",
		"}",
		"export async function work(hold) {",
		"\tconst shared = globalThis.__flowSelfEntry;",
		'\tshared.resource = new AsyncResource("admin");',
		"\tshared.snapshot = AsyncLocalStorage.snapshot();",
		"\tshared.timer = setTimeout(() => {}, 60000);",
		"\tshared.adminRead = () => ({ user: context.user ?? null });",
		"\tconst note = self.job.note;",
		"\tshared.adminSchedule = (how) => schedule(how, note);",
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
		"// What the module's code reads and writes, as itself or through what another module's file made while it loaded.",
		"function loadProbe(tag) {",
		"\tconst out = probe();",
		"\ttry {",
		"\t\tself.secret[tag] = () => tag;",
		'\t\tout.write = "ok";',
		"\t} catch (error) {",
		"\t\tout.write = codeOf(error);",
		"\t}",
		"\treturn out;",
		"}",
		"const load = () => globalThis.__flowSelfEntryLoad;",
		"export function loadOwn() {",
		'\treturn loadProbe("loadOwn");',
		"}",
		"export function loadResource() {",
		'\treturn load().resource.runInAsyncScope(loadProbe, null, "loadResource");',
		"}",
		"export function loadSnapshot() {",
		'\treturn load().snapshot(loadProbe, "loadSnapshot");',
		"}",
		"export function loadBound() {",
		'\treturn load().resource.bind(loadProbe)("loadBound");',
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
		"}",
		"// Another module's api node, read by its own code inside a flow it entered by itself, handed to Node.",
		"function handPeek(tag, peek = self.job.peek) {",
		"\treturn new Promise((resolve) => {",
		"\t\tPromise.resolve(tag).then(peek).then(resolve);",
		"\t});",
		"}",
		"export function hostResourcePeek() {",
		'\treturn shared().hostResource.runInAsyncScope(() => handPeek("evilResourcePeek"));',
		"}",
		"export function hostTimerPeek() {",
		'\treturn adopt(shared().hostTimer, () => handPeek("evilTimerPeek"));',
		"}",
		"// The node is read before an await; after it the module only hands it to Node.",
		"export function hostResourcePeekAwait() {",
		"\treturn shared().hostResource.runInAsyncScope(async () => {",
		"\t\tconst peek = self.job.peek;",
		"\t\tawait null;",
		'\t\treturn handPeek("evilResourcePeekAwait", peek);',
		"\t});",
		"}",
		"export function resourcePeek() {",
		'\treturn shared().resource.runInAsyncScope(() => handPeek("evilAdminPeek"));',
		"}",
		"// Hands `fn` to Node to run later, the way `how` names, without calling it itself.",
		"function schedule(how, fn) {",
		'\tif (how === "then") Promise.resolve().then(fn);',
		'\telse if (how === "timeout") setTimeout(fn, 0);',
		'\telse if (how === "immediate") setImmediate(fn);',
		'\telse if (how === "microtask") queueMicrotask(fn);',
		'\telse if (how === "tick") process.nextTick(fn);',
		'\telse if (how === "nested") new AsyncResource("inner").runInAsyncScope(() => Promise.resolve().then(fn));',
		"\telse throw new Error(how);",
		"}",
		"// Another module's api node, read outside the flow; inside the flow the module's code only hands it to Node.",
		"export function hostResourceSchedule(how) {",
		"\tconst note = self.job.note;",
		"\tshared().hostResource.runInAsyncScope(() => schedule(how, note));",
		"\treturn true;",
		"}",
		"export function hostSnapshotSchedule(how) {",
		"\tconst note = self.job.note;",
		"\tshared().hostSnapshot(() => schedule(how, note));",
		"\treturn true;",
		"}",
		"export function hostTimerSchedule(how) {",
		"\tconst note = self.job.note;",
		"\treturn adopt(shared().hostTimer, () => (schedule(how, note), true));",
		"}",
		"export function resourceSchedule(how) {",
		"\tconst note = self.job.note;",
		"\tshared().resource.runInAsyncScope(() => schedule(how, note));",
		"\treturn true;",
		"}",
		"// Binds another module's api node to the host's resource from its own call, and hands the bound function to Node.",
		"export function hostResourceBindSchedule(how) {",
		"\tschedule(how, shared().hostResource.bind(self.job.note));",
		"\treturn true;",
		"}",
		"// The same bind, made inside the run it entered by itself through the host's resource.",
		"export function hostResourceBindInside(how) {",
		"\tconst note = self.job.note;",
		"\tshared().hostResource.runInAsyncScope(() => schedule(how, shared().hostResource.bind(note)));",
		"\treturn true;",
		"}",
		"// Registers another module's function as a listener on the host's emitter, from inside the run it entered by itself.",
		"export function hostResourceListen() {",
		"\tconst note = self.job.getNote();",
		'\tshared().hostResource.runInAsyncScope(() => shared().hostEmitter.on("ping", note));',
		"\treturn true;",
		"}",
		"// The other call's own function, run through its resource by this module (a pool running a requester's callback).",
		"export function adminSchedule(how) {",
		"\treturn shared().resource.runInAsyncScope(shared().adminSchedule, null, how);",
		"}"
	]);
	// A module whose calls hand out a plain function and an async function that read the context they run in.
	write("api/job/job.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		'import { AsyncResource } from "node:async_hooks";',
		"// Hands `fn` to Node to run later, the way `how` names, without calling it itself.",
		"function schedule(how, fn) {",
		'\tif (how === "then") Promise.resolve().then(fn);',
		'\telse if (how === "timeout") setTimeout(fn, 0);',
		'\telse if (how === "immediate") setImmediate(fn);',
		'\telse if (how === "microtask") queueMicrotask(fn);',
		'\telse if (how === "tick") process.nextTick(fn);',
		'\telse if (how === "nested") new AsyncResource("inner").runInAsyncScope(() => Promise.resolve().then(fn));',
		"\telse throw new Error(how);",
		"}",
		"export function note() {",
		"\tglobalThis.__flowSelfEntry.notes.push(context.user ?? null);",
		"}",
		"// The module's own function, handed out as it is: it notes the context it runs in.",
		"const rawNote = function rawNote() {",
		"\tglobalThis.__flowSelfEntry.notes.push(context.user ?? null);",
		"};",
		"export function getNote() {",
		"\treturn rawNote;",
		"}",
		"// The call itself registers the module's own function as a listener.",
		"export function listen(emitter, event) {",
		"\temitter.on(event, rawNote);",
		"\treturn true;",
		"}",
		"export function schedules(how) {",
		"\tschedule(how, self.job.note);",
		"}",
		"export function schedulesBound(how) {",
		"\tschedule(how, AsyncResource.bind(self.job.note));",
		"}",
		"export async function schedulesAfterAwait(how) {",
		"\tawait null;",
		"\tschedule(how, self.job.note);",
		"}",
		"export function peek(tag) {",
		"\tconst seen = context.user ?? null;",
		"\tif (typeof tag === 'string') globalThis.__flowSelfEntry.seen[tag] = seen;",
		"\treturn seen;",
		"}",
		"const asyncReader = async function asyncReader(tag) {",
		"\tconst before = context.user ?? null;",
		"\tawait null;",
		"\tconst after = context.user ?? null;",
		"\tawait new Promise((resolve) => setTimeout(resolve, 1));",
		"\tconst seen = [before, after, context.user ?? null, this?.mark ?? null];",
		"\tglobalThis.__flowSelfEntry.seen[tag] = seen;",
		"\treturn seen;",
		"};",
		"export function getAsyncReader() {",
		"\treturn asyncReader;",
		"}"
	]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		'import { AsyncResource, AsyncLocalStorage } from "node:async_hooks";',
		'import { EventEmitter } from "node:events";',
		'import net from "node:net";',
		'const [mode, provenance, attribution, part = "self"] = process.argv.slice(2);',
		'const root = new URL(".", import.meta.url).pathname;',
		"const tick = () => new Promise((resolve) => setTimeout(resolve, 5));",
		"const codeOf = (error) => error?.code ?? String(error);",
		"async function make() {",
		'\tconst config = { base: root + "api", silent: true, context: { app: "demo" }, scope: { isolation: "partial" } };',
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
		"\tglobalThis.__flowSelfEntry = { seen: {} };",
		"\tawait api.evil.plant();",
		"\treturn api;",
		"}",
		"const out = {};",
		"// Hands `fn` to Node to run later, the way `how` names, without calling it itself.",
		"function schedule(how, fn) {",
		'\tif (how === "then") Promise.resolve().then(fn);',
		'\telse if (how === "timeout") setTimeout(fn, 0);',
		'\telse if (how === "immediate") setImmediate(fn);',
		'\telse if (how === "microtask") queueMicrotask(fn);',
		'\telse if (how === "tick") process.nextTick(fn);',
		'\telse if (how === "nested") new AsyncResource("inner").runInAsyncScope(() => Promise.resolve().then(fn));',
		"\telse throw new Error(how);",
		"}",
		'const HOWS = ["then", "timeout", "immediate", "microtask", "tick", "nested"];',
		"const settle = () => new Promise((resolve) => setTimeout(resolve, 20));",
		"// A job Node runs that throws is noted by what it threw.",
		'if (part === "scheduled") process.setUncaughtExceptionCaptureCallback((error) => globalThis.__flowSelfEntry.notes.push(codeOf(error)));',
		"// What `fn` (scheduling the job leaf's note) left noted once its jobs ran.",
		"async function notes(fn) {",
		"\tglobalThis.__flowSelfEntry.notes = [];",
		"\ttry {",
		"\t\tawait fn();",
		"\t} catch (error) {",
		"\t\treturn codeOf(error);",
		"\t}",
		"\tawait settle();",
		"\treturn globalThis.__flowSelfEntry.notes;",
		"}",
		'if (part === "scheduled") {',
		"\t// A run() the host opened, entered by evil itself through what the host made there; evil only schedules.",
		"\t{",
		"\t\tconst api = await make();",
		"\t\tconst shared = globalThis.__flowSelfEntry;",
		'\t\tawait api.slothlet.context.run({ user: "root" }, () => {',
		'\t\t\tshared.hostResource = new AsyncResource("host");',
		"\t\t\tshared.hostSnapshot = AsyncLocalStorage.snapshot();",
		"\t\t\tshared.hostTimer = setTimeout(() => {}, 60000);",
		"\t\t});",
		"\t\tfor (const how of HOWS) {",
		'\t\t\tfor (const route of ["hostResourceSchedule", "hostSnapshotSchedule", "hostTimerSchedule", "hostResourceBindSchedule", "hostResourceBindInside"]) {',
		'\t\t\t\tout[route + ":" + how] = await notes(() => api.slothlet.context.run({ user: "mallory" }, () => api.evil[route](how)));',
		"\t\t\t}",
		"\t\t\t// The host's own resource, used by the host afterwards, still runs in its run (the pool pattern).",
		'\t\t\tout["hostAfter:" + how] = await notes(() => shared.hostResource.runInAsyncScope(() => schedule(how, api.job.note)));',
		"\t\t\t// The host's own scheduling inside its run, and a call's own scheduling, keep the run.",
		'\t\t\tout["host:" + how] = await notes(() => api.slothlet.context.run({ user: "root" }, () => schedule(how, api.job.note)));',
		'\t\t\tout["hostAfterAwait:" + how] = await notes(() =>',
		'\t\t\t\tapi.slothlet.context.run({ user: "root" }, async () => {',
		"\t\t\t\t\tawait null;",
		"\t\t\t\t\tschedule(how, api.job.note);",
		"\t\t\t\t})",
		"\t\t\t);",
		'\t\t\tout["call:" + how] = await notes(() => api.slothlet.context.run({ user: "root" }, () => api.job.schedules(how)));',
		'\t\t\tout["callAfterAwait:" + how] = await notes(() => api.slothlet.context.run({ user: "root" }, () => api.job.schedulesAfterAwait(how)));',
		"\t\t\t// A function the run's own code binds inside the run (a resource of the run, or a resource bind() makes) and",
		"\t\t\t// hands Node keeps the run when Node calls it.",
		'\t\t\tout["hostBound:" + how] = await notes(() =>',
		'\t\t\t\tapi.slothlet.context.run({ user: "root" }, () => schedule(how, new AsyncResource("bind").bind(api.job.note)))',
		"\t\t\t);",
		'\t\t\tout["hostStaticBound:" + how] = await notes(() =>',
		'\t\t\t\tapi.slothlet.context.run({ user: "root" }, async () => {',
		"\t\t\t\t\tawait null;",
		"\t\t\t\t\tschedule(how, AsyncResource.bind(api.job.note));",
		"\t\t\t\t})",
		"\t\t\t);",
		'\t\t\tout["callBound:" + how] = await notes(() => api.slothlet.context.run({ user: "root" }, () => api.job.schedulesBound(how)));',
		"\t\t}",
		"\t\tclearTimeout(shared.hostTimer);",
		'\t\tout.mode = mode === "none" ? null : api.slothlet.permissions.control.mode();',
		"\t\tawait api.slothlet.shutdown();",
		"\t}",
		"\t// Another request's call (root) held open while evil, in its own request (mallory), enters it and only schedules.",
		"\t{",
		"\t\tconst api = await make();",
		"\t\tlet release;",
		"\t\tconst hold = new Promise((resolve) => (release = resolve));",
		'\t\tconst first = api.slothlet.context.run({ user: "root" }, () => api.admin.work(hold));',
		"\t\tawait tick();",
		"\t\tfor (const how of HOWS) {",
		'\t\t\tout["resourceSchedule:" + how] = await notes(() => api.slothlet.context.run({ user: "mallory" }, () => api.evil.resourceSchedule(how)));',
		'\t\t\tout["adminSchedule:" + how] = await notes(() => api.slothlet.context.run({ user: "mallory" }, () => api.evil.adminSchedule(how)));',
		"\t\t}",
		"\t\trelease();",
		'\t\tout["resourceSchedule:first"] = await first;',
		"\t\tawait api.slothlet.shutdown();",
		"\t}",
		"\tconsole.log(JSON.stringify(out));",
		"\tprocess.exit(0);",
		"}",
		"// One request (root) holds admin's call open while another (mallory) runs evil.",
		'for (const route of ["own", "resource", "resourceAwait", "snapshot", "bound", "timer", "adminCode", "resourcePeek"]) {',
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
		"// Entered through what another module's file made while it loaded.",
		"{",
		"\tconst api = await make();",
		"\tawait api.loader.ping();",
		'\tfor (const route of ["loadOwn", "loadResource", "loadSnapshot", "loadBound"]) {',
		"\t\ttry {",
		'\t\t\tout[route] = await api.slothlet.context.run({ user: "mallory" }, () => api.evil[route]());',
		"\t\t} catch (error) {",
		"\t\t\tout[route] = codeOf(error);",
		"\t\t}",
		'\t\tout[route + ":planted"] = typeof api.secret[route];',
		"\t}",
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
		"\t\t\tconst seen = attempt();",
		"\t\t\t// A run's mode change applies to that run only: read inside it, and again once it has ended.",
		'\t\t\tout[route + ":modeInRun"] = mode === "none" ? null : api.slothlet.permissions.control.mode();',
		"\t\t\treturn seen;",
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
		"// A module's own function the host registers as a listener inside a run, on a server Node emits events on.",
		"{",
		"\tconst api = await make();",
		"\tconst shared = globalThis.__flowSelfEntry;",
		"\tshared.notes = [];",
		'\tawait api.slothlet.context.run({ user: "root" }, async () => {',
		"\t\tconst server = net.createServer();",
		'\t\tserver.on("connection", api.job.getNote());',
		'\t\tserver.on("connection", (socket) => socket.destroy());',
		'\t\tawait new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));',
		"\t\t// Registered after an await too, with once().",
		'\t\tserver.once("connection", api.job.getNote());',
		'\t\tconst socket = net.connect(server.address().port, "127.0.0.1");',
		'\t\tsocket.on("error", () => {});',
		'\t\tawait new Promise((resolve) => socket.on("close", resolve));',
		"\t\tawait new Promise((resolve) => server.close(resolve));",
		"\t});",
		"\tout.hostListener = shared.notes;",
		"\t// The host's emitter: a call of the run registers the module's function, and a module that entered the run by",
		"\t// itself registers another; the host emits outside every run.",
		"\tshared.notes = [];",
		"\tshared.hostEmitter = new EventEmitter();",
		'\tawait api.slothlet.context.run({ user: "root" }, () => {',
		'\t\tshared.hostResource = new AsyncResource("host");',
		'\t\treturn api.job.listen(shared.hostEmitter, "call");',
		"\t});",
		'\tshared.hostEmitter.emit("call");',
		"\tout.callListener = shared.notes;",
		"\tshared.notes = [];",
		'\tawait api.slothlet.context.run({ user: "mallory" }, () => api.evil.hostResourceListen());',
		'\tshared.hostEmitter.emit("ping");',
		'\tawait api.slothlet.context.run({ user: "root" }, () => shared.hostEmitter.emit("ping"));',
		"\tout.selfEnteredListener = shared.notes;",
		"\tawait api.slothlet.shutdown();",
		"}",
		"// A thenable that isn't a native promise, returned by a run() / scope() callback, settles in the run.",
		"{",
		"\tconst api = await make();",
		"\tconst thenable = () => ({ then(resolve) { resolve(api.job.peek()); } });",
		"\tconst rejecting = () => ({ then(resolve, reject) { reject(new Error(String(api.job.peek()))); } });",
		'\tout.thenableRun = await api.slothlet.context.run({ user: "root" }, thenable);',
		'\tout.thenableScope = await api.slothlet.context.scope({ context: { user: "root" }, fn: thenable });',
		"\ttry {",
		'\t\tawait api.slothlet.context.run({ user: "root" }, rejecting);',
		"\t} catch (error) {",
		"\t\tout.thenableRejected = error.message;",
		"\t}",
		"\t// A native promise and a plain value come back as before.",
		'\tout.promiseRun = await api.slothlet.context.run({ user: "root" }, async () => api.job.peek());',
		'\tout.valueRun = await api.slothlet.context.run({ user: "root" }, () => ({ user: api.job.peek() }));',
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
		"\t\tout.readerSameAsOutside = reader === outside;",
		"\t\t// An emitter's off() finds the listener on() was given by the same function read again.",
		"\t\tconst emitter = new EventEmitter();",
		'\t\temitter.on("x", api.mod.getReader());',
		'\t\temitter.off("x", api.mod.getReader());',
		'\t\tout.readerOffRemoves = emitter.listenerCount("x");',
		'\t\tawait Promise.resolve("then").then(reader);',
		'\t\tsetTimeout(reader, 0, "timeout");',
		'\t\tsetImmediate(reader, "immediate");',
		'\t\tprocess.nextTick(reader, "tick");',
		"\t\tqueueMicrotask(reader);",
		'\t\tconst interval = setInterval((tag) => (clearInterval(interval), reader(tag)), 1, "intervalHost");',
		'\t\tshared.interval = setInterval(reader, 1, "interval");',
		"\t\tawait tick();",
		"\t\tclearInterval(shared.interval);",
		"\t\tawait null;",
		'\t\tsetTimeout(reader, 0, "timeoutAfterAwait");',
		'\t\tprocess.nextTick(reader, "tickAfterAwait");',
		"\t\tawait tick();",
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
		"// Another module's api node handed to Node by a module's own code that entered a run() the host opened by itself.",
		'for (const route of ["hostResourcePeek", "hostTimerPeek", "hostResourcePeekAwait"]) {',
		"\tconst api = await make();",
		"\tconst shared = globalThis.__flowSelfEntry;",
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
		"\t// The host's own use of its resource afterwards still runs in its run (as a pool uses a requester's resource).",
		"\tout[route + ':hostAfter'] = await new Promise((resolve) =>",
		"\t\tshared.hostResource.runInAsyncScope(() => Promise.resolve('hostAfter').then(api.job.peek).then(resolve))",
		"\t);",
		"\tawait api.slothlet.shutdown();",
		"}",
		"// A module's async function a call hands the run's own code, awaited by the host and called by Node later.",
		"{",
		"\tconst api = await make();",
		"\tconst shared = globalThis.__flowSelfEntry;",
		"\tconst outside = api.job.getAsyncReader();",
		'\tawait api.slothlet.context.run({ user: "root" }, async () => {',
		"\t\tconst reader = api.job.getAsyncReader();",
		"\t\tout.asyncReaderSame = reader === api.job.getAsyncReader();",
		"\t\tout.asyncReaderShape = [typeof reader, reader.name, reader.length];",
		'\t\tconst pending = reader("direct");',
		"\t\tout.asyncReaderPromise = pending instanceof Promise;",
		"\t\tout.asyncReaderResult = await pending;",
		'\t\tawait Promise.resolve("then").then(reader);',
		'\t\tsetTimeout(reader, 0, "timeout");',
		"\t\tawait new Promise((resolve) => setTimeout(resolve, 30));",
		"\t\tawait null;",
		'\t\tawait Reflect.apply(reader, { mark: "this" }, ["afterAwait"]);',
		"\t});",
		'\tawait outside("outside");',
		"\t// The function itself, read outside every run, called by the run's own code and awaited there.",
		'\tout.asyncReaderRaw = await api.slothlet.context.run({ user: "root" }, () => outside("raw"));',
		"\tout.asyncReaderSeen = shared.seen;",
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
 * @param {string} [part="self"] - Which part of the probe runs: "self" (code entering a flow by itself) or "scheduled"
 *   (code entering a flow by itself that only hands Node jobs there).
 * @returns {Record<string, *>} What each route saw.
 */
function probe(nodeFlags, mode, provenance = "provenance", attribution = "precise", part = "self") {
	const result = spawnSync(process.execPath, [...nodeFlags, "--conditions=slothlet-dev", PROBE, mode, provenance, attribution, part], {
		cwd: process.cwd(),
		env: process.env,
		encoding: "utf8",
		timeout: 120000
	});
	if (result.status !== 0) throw new Error(`probe failed (${result.status}): ${result.stderr}`);
	return JSON.parse(result.stdout.trim().split("\n").pop());
}

// Node 24 and later switch AsyncContextFrame off with this flag.
const FRAMES = process.allowedNodeEnvironmentFlags.has("--no-async-context-frame")
	? [
			["default async context", []],
			["AsyncContextFrame off", ["--no-async-context-frame"]]
		]
	: [["default async context", []]];

const CONFIGS = [
	["no permissions config", "none", "provenance", "precise"],
	["permissions off", "off", "provenance", "precise"],
	["permissions disabled", "disabled", "provenance", "precise"],
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

		it.each(["loadResource", "loadSnapshot", "loadBound"])(
			"its own code entering what another module's file made while it loaded (%s) acts as itself",
			(route) => {
				expect(result[route].user).toBeNull();
				expect(result[route].self).toMatch(/^evil(\.|$)/);
				expect(result[route].secret).toBe(result.loadOwn.secret);
				expect(result[route].write).toBe(result.loadOwn.write);
				expect(result[route + ":planted"]).toBe(result["loadOwn:planted"]);
			}
		);

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
				expect(result["hostCalls:modeInRun"]).toBe("off");
				expect(result["hostCalls:mode"]).toBe("on");
				expect(result.hostCallsAfterAwait).toMatchObject({ control: "ok", write: "ok" });
				expect(result["hostCallsAfterAwait:modeInRun"]).toBe("off");
				expect(result["hostCallsAfterAwait:mode"]).toBe("on");
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

		it("a module's function the host or a call registers as a listener inside a run keeps the run when Node emits", () => {
			expect(result.hostListener).toEqual(["root", "root"]);
			expect(result.callListener).toEqual(["root"]);
		});

		it("a listener a module registers from inside a run it entered by itself runs outside the run", () => {
			expect(result.selfEnteredListener).toEqual([null, null]);
		});

		it("a thenable a run() or scope() callback returns settles in the run", () => {
			expect(result.thenableRun).toBe("root");
			expect(result.thenableScope).toBe("root");
			expect(result.thenableRejected).toBe("root");
			expect(result.promiseRun).toBe("root");
			expect(result.valueRun).toEqual({ user: "root" });
		});

		it("a function a call hands the run's own code keeps the run when Node calls it later", () => {
			expect(result.readerSeen.then).toEqual(["root", null]);
			expect(result.readerSeen.timeout).toEqual(["root", null]);
			for (const tag of ["immediate", "tick", "undefined", "interval", "intervalHost", "timeoutAfterAwait", "tickAfterAwait"]) {
				expect([tag, result.readerSeen[tag]]).toEqual([tag, ["root", null]]);
			}
			expect(result.readerSeen.thenAfterAwait).toEqual(["root", null]);
			expect(result.readerSeen.thenThis).toEqual(["root", "bound"]);
			expect(result.readerSeen.direct).toEqual(["root", "this"]);
			expect(result.readerInRunShape).toEqual(["function", "reader", 1]);
		});

		it("the same function read inside a run and outside every run is the same value", () => {
			expect(result.readerInRunSame).toBe(true);
			expect(result.readerOutsideSame).toBe(true);
			// The function itself in every permission mode (or, with "precise", its one stand-in), inside a run or not.
			expect(result.readerSameAsOutside).toBe(true);
			expect(result.readerOffRemoves).toBe(0);
			expect(result.readerHandedBackIsOwn).toBe(true);
			expect(result.readerSeen.outside).toEqual([null, null]);
		});

		// Code that entered the run by itself acts outside it, and so does every job it hands Node: the function it is
		// handed runs outside the run, whether it comes back as itself or as a stand-in of its module's ("precise").
		it.each(["hostResourceReader", "hostTimerReader"])(
			"the function read by a module's own code that entered a run() by itself through the host's %s runs outside the run",
			(route) => {
				expect(result[route][0]).toBeNull();
			}
		);

		it.each(["hostResourcePeek", "hostTimerPeek", "hostResourcePeekAwait"])(
			"an api node a module's own code that entered a run() by itself through the host's %s hands Node runs outside the run",
			(route) => {
				expect(result[route]).toBeNull();
			}
		);

		it.each(["hostResourcePeek", "hostTimerPeek", "hostResourcePeekAwait"])(
			"after a module entered the run by itself through %s, the host's own resource still runs in the run",
			(route) => {
				expect(result[route + ":hostAfter"]).toBe("root");
			}
		);

		it("an api node a module's own code hands Node from another request's resource runs outside that request", () => {
			expect(result.resourcePeek).toBeNull();
			expect(result["resourcePeek:first"]).toEqual({ user: "root" });
		});

		it("a module's async function a call hands the run's own code keeps the run after its awaits", () => {
			for (const tag of ["direct", "then", "timeout"]) expect(result.asyncReaderSeen[tag]).toEqual(["root", "root", "root", null]);
			expect(result.asyncReaderSeen.afterAwait).toEqual(["root", "root", "root", "this"]);
			expect(result.asyncReaderResult).toEqual(["root", "root", "root", null]);
			expect(result.asyncReaderPromise).toBe(true);
		});

		it("a module's async function read outside every run and called by the run's own code keeps the run after its awaits", () => {
			expect(result.asyncReaderSeen.raw).toEqual(["root", "root", "root", null]);
			expect(result.asyncReaderRaw).toEqual(["root", "root", "root", null]);
		});

		it("the async function is the same value in one run, shaped as itself, and outside every run sees no run", () => {
			expect(result.asyncReaderSame).toBe(true);
			expect(result.asyncReaderShape).toEqual(["function", "asyncReader", 1]);
			expect(result.asyncReaderSeen.outside).toEqual([null, null, null, null]);
		});
	});
});

// Every configuration: on the async runtime slothlet tells the async resources code that entered a flow by itself makes
// there (an async hook, installed while any async instance lives, whatever its permission mode), so a job it hands Node
// runs outside the flow even when the code never touched slothlet inside it, and a job the flow's own code hands Node
// keeps the flow.

// "strict" refuses to start without AsyncContextFrame (a baseline check): run only where Node has it on by default.
const STRICT_CONFIG = ["permissions strict", "strict", "provenance", "precise"];
const framesOnByDefault = process.allowedNodeEnvironmentFlags.has("--no-async-context-frame");

const HOWS = ["then", "timeout", "immediate", "microtask", "tick", "nested"];

describe.each(FRAMES)("Permissions > jobs scheduled by module code that entered a flow by itself > %s", (_label, nodeFlags) => {
	const configs = framesOnByDefault && nodeFlags.length === 0 ? [...CONFIGS, STRICT_CONFIG] : CONFIGS;
	describe.each(configs)("%s", (_name, mode, provenance, attribution) => {
		let result;

		beforeAll(() => {
			result = probe(nodeFlags, mode, provenance, attribution, "scheduled");
		});

		it.each(HOWS)("an api node handed to Node (%s) from inside a run() the host opened runs outside the run", (how) => {
			for (const route of ["hostResourceSchedule", "hostSnapshotSchedule", "hostTimerSchedule", "hostResourceBindInside"]) {
				expect([route, result[route + ":" + how]]).toEqual([route, [null]]);
			}
			expect(result.mode).toBe(mode === "none" ? null : mode);
		});

		it.each(HOWS)("an api node handed to Node (%s) from inside another request's call runs outside that request", (how) => {
			expect(result["resourceSchedule:" + how]).toEqual([null]);
			expect(result["resourceSchedule:first"]).toEqual({ user: "root" });
		});

		it.each(HOWS)("the other call's own function, run through its resource, schedules (%s) in its request", (how) => {
			expect(result["adminSchedule:" + how]).toEqual(["root"]);
		});

		it.each(HOWS)("the host's own scheduling (%s) inside its run keeps the run, also after an await", (how) => {
			expect(result["host:" + how]).toEqual(["root"]);
			expect(result["hostAfterAwait:" + how]).toEqual(["root"]);
		});

		it.each(HOWS)("the host's own resource, used by the host after a module entered it, keeps the run (%s)", (how) => {
			expect(result["hostAfter:" + how]).toEqual(["root"]);
		});

		it.each(HOWS)("a function the run's own code binds inside the run and hands Node (%s) keeps the run", (how) => {
			expect(result["hostBound:" + how]).toEqual(["root"]);
			expect(result["hostStaticBound:" + how]).toEqual(["root"]);
			expect(result["callBound:" + how]).toEqual(["root"]);
		});

		it.each(HOWS)("an api node a module binds to the host's resource from its own call and hands Node (%s) runs outside the run", (how) => {
			expect(result["hostResourceBindSchedule:" + how]).toEqual([null]);
		});

		it.each(HOWS)("a call's own scheduling (%s) keeps the run, also after an await", (how) => {
			expect(result["call:" + how]).toEqual(["root"]);
			expect(result["callAfterAwait:" + how]).toEqual(["root"]);
		});
	});
});

describe("Permissions > the async hook that tells jobs apart is installed while any async instance lives", () => {
	const instances = [];
	const make = async (permissions) => {
		const config = { base: path.join(ROOT, "api"), silent: true, runtime: "async" };
		if (permissions !== undefined) config.permissions = permissions;
		const api = await slothlet(config);
		instances.push(api);
		return api;
	};

	afterEach(async () => {
		while (instances.length) await instances.pop().slothlet.shutdown();
	});

	it.each([
		["no permissions config", undefined],
		["permissions off", { mode: "off" }],
		["permissions disabled", { mode: "disabled" }],
		["permissions on", { mode: "on" }]
	])("%s: one hook for every async instance, removed after the last shuts down", async (_name, permissions) => {
		// Zero unless another async instance of this worker is still alive: at most one hook per process.
		const base = jobHookCount();
		expect(base).toBeLessThanOrEqual(1);
		const first = await make(permissions);
		expect(jobHookCount()).toBe(1);
		await make(permissions);
		expect(jobHookCount()).toBe(1);
		await first.slothlet.shutdown();
		instances.splice(instances.indexOf(first), 1);
		expect(jobHookCount()).toBe(1);
		await instances.pop().slothlet.shutdown();
		expect(jobHookCount()).toBe(base);
	});

	it("instances of every permission mode share the one hook", async () => {
		const base = jobHookCount();
		await make();
		await make({ mode: "off" });
		await make({ mode: "disabled" });
		await make({ mode: "on" });
		expect(jobHookCount()).toBe(1);
		while (instances.length) await instances.pop().slothlet.shutdown();
		expect(jobHookCount()).toBe(base);
	});

	it("a live-runtime instance installs no hook", async () => {
		const base = jobHookCount();
		const api = await slothlet({ base: path.join(ROOT, "api"), silent: true, runtime: "live" });
		try {
			expect(jobHookCount()).toBe(base);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
