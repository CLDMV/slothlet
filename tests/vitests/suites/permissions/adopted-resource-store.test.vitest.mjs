/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/adopted-resource-store.test.vitest.mjs
 *	@Date: 2026-11-18T00:00:00-08:00 (1794988800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:11-08:00 (1795869131)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A host's async resource stays the host's after module code entered it by itself.
 *
 * @description
 * While `AsyncContextFrame` is off, Node keeps what an `AsyncLocalStorage` holds on the async resource itself, and
 * where on it depends on the Node: directly under the storage's symbol, or (Node 24.20 / 26.6 onward) in an object under
 * `Symbol(kAsyncLocalStorageContext)`. When module code enters a resource the host made inside a `run()`
 * (`res.runInAsyncScope()`), slothlet puts a stand-in store on that resource for the module's stretch of code and takes
 * it back off afterwards. The host's later work on the same resource then runs as the host again, in its run.
 *
 * Each case runs in a child process with Node's default async context and, where Node has the switch, with
 * `AsyncContextFrame` off. The answers are the same in both: frames on, where Node keeps nothing on the resource, is the
 * reference.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "adopted-resource-store");
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
	write("api/job/job.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		"export function who() {",
		"\treturn context.user ?? null;",
		"}",
		"export function record() {",
		"\tglobalThis.__adoptedResourceStore.push(context.user ?? null);",
		"}"
	]);
	write("intruder/intruder.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		"const codeOf = (error) => error?.code ?? String(error);",
		"// What the module's code tries once it runs inside the host's resource.",
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
		"// Enters the host's resource by itself, hands Node another module's api node there, and tries the host's rights.",
		"export function enter(resource) {",
		"\tconst record = self.job.record;",
		"\treturn resource.runInAsyncScope(() => {",
		"\t\tPromise.resolve().then(record);",
		"\t\tsetTimeout(record, 0);",
		"\t\treturn attempt();",
		"\t});",
		"}",
		"// The same, after an await inside the host's resource.",
		"export function enterAwait(resource) {",
		"\tconst record = self.job.record;",
		"\treturn resource.runInAsyncScope(async () => {",
		"\t\tawait null;",
		"\t\tPromise.resolve().then(record);",
		"\t\tsetTimeout(record, 0);",
		"\t\treturn attempt();",
		"\t});",
		"}",
		"// A timer of the module's own, given the async context Node keeps on the host's timer.",
		"export function adopt(timer) {",
		"\treturn new Promise((resolve) => {",
		"\t\tconst mine = setTimeout(() => resolve(attempt()), 5);",
		"\t\tfor (const key of Object.getOwnPropertySymbols(timer)) {",
		"\t\t\tif (/store|frame|context/i.test(String(key))) mine[key] = timer[key];",
		"\t\t}",
		"\t});",
		"}"
	]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		'import { AsyncResource } from "node:async_hooks";',
		'const root = new URL(".", import.meta.url).pathname;',
		"const settle = () => new Promise((resolve) => setTimeout(resolve, 20));",
		"const codeOf = (error) => error?.code ?? String(error);",
		"// A job Node runs that throws is noted by what it threw.",
		"process.setUncaughtExceptionCaptureCallback((error) => globalThis.__adoptedResourceStore?.push(codeOf(error)));",
		"async function make() {",
		"\tconst api = await slothlet({",
		'\t\tbase: root + "api",',
		"\t\tsilent: true,",
		'\t\tpermissions: { mode: "on", rules: [{ caller: "intruder.**", target: "secret.**", effect: "deny" }] }',
		"\t});",
		'\tawait api.slothlet.api.add("intruder", root + "intruder", { id: "intruder" });',
		"\treturn api;",
		"}",
		"// The host's work on its own resource: what it reads, a write of its own, and a job it hands Node from there.",
		"async function hostWork(api, resource, tag) {",
		"\tconst out = {};",
		"\tout.user = resource.runInAsyncScope(() => api.job.who());",
		"\ttry {",
		"\t\tresource.runInAsyncScope(() => {",
		'\t\t\tapi.secret["host_" + tag] = () => "host";',
		"\t\t});",
		'\t\tout.write = "ok";',
		"\t} catch (error) {",
		"\t\tout.write = codeOf(error);",
		"\t}",
		"\t// Api nodes the host hands Node from its resource, run by Node with nothing of the host's on the stack.",
		"\ttry {",
		"\t\tout.then = await resource.runInAsyncScope(() => Promise.resolve().then(api.job.who));",
		"\t} catch (error) {",
		"\t\tout.then = codeOf(error);",
		"\t}",
		"\tglobalThis.__adoptedResourceStore = [];",
		"\tresource.runInAsyncScope(() => {",
		"\t\tsetTimeout(api.job.record, 0);",
		"\t\tsetImmediate(api.job.record);",
		"\t\tprocess.nextTick(api.job.record);",
		"\t\tqueueMicrotask(api.job.record);",
		"\t});",
		"\tawait settle();",
		"\tout.scheduled = globalThis.__adoptedResourceStore;",
		"\treturn out;",
		"}",
		"const out = {};",
		'for (const route of ["enter", "enterAwait"]) {',
		"\tconst api = await make();",
		"\tlet resource;",
		'\tawait api.slothlet.context.run({ user: "root" }, () => {',
		'\t\tresource = new AsyncResource("host");',
		"\t});",
		"\tout[route + ':before'] = await hostWork(api, resource, 'before');",
		"\ttry {",
		"\t\tglobalThis.__adoptedResourceStore = [];",
		'\t\tout[route] = await api.slothlet.context.run({ user: "mallory" }, () => api.intruder[route](resource));',
		"\t} catch (error) {",
		"\t\tout[route] = codeOf(error);",
		"\t}",
		"\tawait settle();",
		"\tout[route + ':jobs'] = globalThis.__adoptedResourceStore;",
		"\tout[route + ':after'] = await hostWork(api, resource, 'after');",
		"\t// Entered outside any run, too.",
		"\ttry {",
		"\t\tglobalThis.__adoptedResourceStore = [];",
		"\t\tout[route + ':bare'] = await api.intruder[route](resource);",
		"\t} catch (error) {",
		"\t\tout[route + ':bare'] = codeOf(error);",
		"\t}",
		"\tawait settle();",
		"\tout[route + ':bareJobs'] = globalThis.__adoptedResourceStore;",
		"\tout[route + ':afterBare'] = await hostWork(api, resource, 'afterBare');",
		"\tout[route + ':mode'] = api.slothlet.permissions.control.mode();",
		"\tout[route + ':planted'] = typeof api.secret.planted;",
		"\tawait api.slothlet.shutdown();",
		"}",
		"// The module's timer, given the context of a live timer the host made inside run().",
		"{",
		"\tconst api = await make();",
		"\tlet timer;",
		'\tawait api.slothlet.context.run({ user: "root" }, () => {',
		"\t\ttimer = setTimeout(() => {}, 60000);",
		"\t});",
		"\ttry {",
		"\t\tout.timer = await api.intruder.adopt(timer);",
		"\t} catch (error) {",
		"\t\tout.timer = codeOf(error);",
		"\t} finally {",
		"\t\tclearTimeout(timer);",
		"\t}",
		"\tout['timer:mode'] = api.slothlet.permissions.control.mode();",
		"\tout['timer:planted'] = typeof api.secret.planted;",
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
 * @returns {Record<string, *>} What each case saw.
 */
function probe(nodeFlags) {
	const result = spawnSync(process.execPath, [...nodeFlags, "--conditions=slothlet-dev", PROBE], {
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

const HOST = { user: "root", write: "ok", then: "root", scheduled: ["root", "root", "root", "root"] };

describe.each(FRAMES)("Permissions > a host resource module code entered > %s", (_label, flags) => {
	let result;

	beforeAll(() => {
		result = probe(flags);
	}, 120000);

	it.each(["enter", "enterAwait"])("the host's work on its resource runs as the host in its run before %s", (route) => {
		expect(result[route + ":before"]).toEqual(HOST);
	});

	it.each(["enter", "enterAwait"])("module code entering the host's resource (%s) gets neither the run nor the host's rights", (route) => {
		expect(result[route].user).toBeNull();
		expect(result[route].control).toBe("PERMISSION_DENIED");
		expect(result[route].write).not.toBe("ok");
		expect(result[route + ":bare"].user).toBeNull();
		expect(result[route + ":bare"].control).toBe("PERMISSION_DENIED");
		expect(result[route + ":bare"].write).not.toBe("ok");
		expect(result[route + ":mode"]).toBe("on");
		expect(result[route + ":planted"]).toBe("undefined");
		// The jobs it handed Node from there run outside the run, as the code that made them.
		expect(result[route + ":jobs"]).toEqual([null, null]);
		expect(result[route + ":bareJobs"]).toEqual([null, null]);
	});

	it.each(["enter", "enterAwait"])(
		"after module code entered it (%s), the host's work on its resource still runs as the host in its run",
		(route) => {
			expect(result[route + ":after"]).toEqual(HOST);
			expect(result[route + ":afterBare"]).toEqual(HOST);
		}
	);

	it("the module's own timer, given the context of the host's live timer, runs as the module", () => {
		expect(result.timer).toEqual({ user: null, control: "PERMISSION_DENIED", write: "LOOSE_SET_NOT_OWNED" });
		expect(result["timer:mode"]).toBe("on");
		expect(result["timer:planted"]).toBe("undefined");
	});
});
