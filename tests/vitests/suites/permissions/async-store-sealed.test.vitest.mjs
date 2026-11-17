/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/async-store-sealed.test.vitest.mjs
 *	@Date: 2026-11-17T05:44:09-08:00 (1794923049)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:26:24-08:00 (1794929184)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code cannot reach slothlet's instance or its handlers through Node's async context.
 *
 * @description
 * Under the async runtime slothlet keeps each call's identity in an `AsyncLocalStorage` store. Node keeps the value a
 * store holds on async resources where `AsyncContextFrame` is off (Node 22, or a later Node run with
 * `--no-async-context-frame`): `async_hooks.executionAsyncResource()`, every promise a module makes and every
 * `AsyncResource` hold it under a symbol a module can list. And a module can replace `AsyncLocalStorage`'s methods on
 * its prototype, on every Node version, and see what slothlet passes to them.
 *
 * Neither may hand a module what slothlet's store holds: the instance, its handlers (the ownership, permission and api
 * managers among them) or a node's wrapper. A child process runs each case (replacing `AsyncLocalStorage`'s methods
 * would disturb vitest itself), with the permission system on and off, with Node's default async context and, where
 * the Node running the suite has the switch, with `AsyncContextFrame` off.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "async-store-sealed");
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
	write("api/base/base.mjs", ["export function ping() {", '\treturn "pong";', "}"]);
	write("other/other.mjs", ["export function c() {", '\treturn "c";', "}"]);
	write("prober/prober.mjs", [
		'import * as asyncHooks from "node:async_hooks";',
		'import { self, context } from "@cldmv/slothlet/runtime";',
		"const INTERNAL = new Set([",
		'\t"Slothlet", "UnifiedWrapper", "ComponentBase", "ApiManager", "OwnershipManager", "PermissionManager",',
		'\t"AsyncContextManager", "LiveContextManager", "EventManager", "HookManager", "Lifecycle", "Metadata",',
		'\t"MaterializeManager", "ModuleManager", "RoutineManager", "VersionManager", "ApiCacheManager", "DormantStore"',
		"]);",
		"const seen = [];",
		"// The first class name of slothlet's own found within a few steps of `value`, walking symbol keys too.",
		"function internalIn(value, depth = 0, visited = new Set()) {",
		'\tif (value === null || (typeof value !== "object" && typeof value !== "function") || visited.has(value) || depth > 4) return null;',
		"\tvisited.add(value);",
		"\tfor (let proto = Object.getPrototypeOf(value); proto; proto = Object.getPrototypeOf(proto)) {",
		'\t\tconst ctor = Object.getOwnPropertyDescriptor(proto, "constructor")?.value;',
		'\t\tif (typeof ctor === "function" && INTERNAL.has(ctor.name)) return ctor.name;',
		"\t}",
		"\tfor (const key of Reflect.ownKeys(value)) {",
		"\t\tlet member;",
		"\t\ttry {",
		"\t\t\tmember = Object.getOwnPropertyDescriptor(value, key)?.value;",
		"\t\t} catch {",
		"\t\t\tcontinue;",
		"\t\t}",
		"\t\tconst found = internalIn(member, depth + 1, visited);",
		"\t\tif (found) return found;",
		"\t}",
		"\treturn null;",
		"}",
		"export function patchStorage() {",
		"\tconst proto = asyncHooks.AsyncLocalStorage.prototype;",
		"\tconst names = new Set();",
		"\tfor (let p = proto; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {",
		"\t\tfor (const name of Object.getOwnPropertyNames(p)) {",
		'\t\t\tif (name !== "constructor" && typeof Object.getOwnPropertyDescriptor(p, name).value === "function") names.add(name);',
		"\t\t}",
		"\t}",
		"\tfor (const name of names) {",
		"\t\tconst original = proto[name];",
		"\t\tproto[name] = function (...args) {",
		"\t\t\tconst result = Reflect.apply(original, this, args);",
		"\t\t\tseen.push(args, result);",
		"\t\t\treturn result;",
		"\t\t};",
		"\t}",
		"\treturn [...names].sort();",
		"}",
		"export async function look() {",
		"\tconst found = {};",
		"\tconst note = (where, value) => {",
		"\t\tconst name = internalIn(value);",
		"\t\tif (name) found[where] = name;",
		"\t};",
		'\tnote("executionAsyncResource", asyncHooks.executionAsyncResource());',
		'\tnote("promise", Promise.resolve(1));',
		'\tnote("asyncResource", new asyncHooks.AsyncResource("probe"));',
		'\tnote("self", self);',
		'\tnote("context", context);',
		"\tawait null;",
		'\tnote("executionAsyncResource after await", asyncHooks.executionAsyncResource());',
		'\tnote("what AsyncLocalStorage methods saw", seen);',
		"\treturn { found, other: self.other.c(), user: context.user ?? null };",
		"}"
	]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		"const [mode, patch] = process.argv.slice(2);",
		'const root = new URL(".", import.meta.url).pathname;',
		'const config = { base: root + "api" };',
		'if (mode !== "none") config.permissions = { mode };',
		"const api = await slothlet(config);",
		'await api.slothlet.api.add("other", root + "other", { id: "other" });',
		'await api.slothlet.api.add("prober", root + "prober", { id: "prober" });',
		'const patched = patch === "patch" ? api.prober.patchStorage() : [];',
		'const result = await api.slothlet.context.run({ user: "u1" }, () => api.prober.look());',
		"await api.shutdown();",
		"console.log(JSON.stringify({ patched: patched.length, ...result }));"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process.
 * @param {string[]} nodeFlags - Flags for Node.
 * @param {string} mode - The permission mode, or "none" for no permissions config.
 * @param {string} patch - "patch" to replace `AsyncLocalStorage`'s methods first, anything else not to.
 * @returns {{patched: number, found: Record<string, string>, other: string, user: string|null}} What the probe saw.
 */
function probe(nodeFlags, mode, patch) {
	const result = spawnSync(process.execPath, [...nodeFlags, "--conditions=slothlet-dev", PROBE, mode, patch], {
		cwd: process.cwd(),
		env: process.env,
		encoding: "utf8",
		timeout: 60000
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

describe.each(FRAMES)("Permissions > async store sealed > %s", (_label, nodeFlags) => {
	describe.each(["on", "off", "none"])("permissions %s", (mode) => {
		it("leaves nothing of slothlet's on the async resources and promises a module can reach", () => {
			const result = probe(nodeFlags, mode, "none");
			expect(result.found).toEqual({});
			expect(result.other).toBe("c");
			expect(result.user).toBe("u1");
		});

		it("hands nothing of slothlet's to AsyncLocalStorage methods a module replaced", () => {
			const result = probe(nodeFlags, mode, "patch");
			expect(result.patched).toBeGreaterThan(0);
			expect(result.found).toEqual({});
			expect(result.other).toBe("c");
			expect(result.user).toBe("u1");
		});
	});
});
