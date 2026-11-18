/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/host-flow-module-code-matrix.test.vitest.mjs
 *	@Date: 2026-11-18T00:00:00-08:00 (1794988800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T05:59:25-08:00 (1795010365)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code the host runs inside a flow it opened answers as the module, across runtimes, modes,
 * permission settings, isolation modes and the routes that code reaches the host by.
 *
 * @description
 * A module mounted at `plug` owns only `plug.*`. It leaves a function of its own on `globalThis`, a method on an object
 * on `globalThis`, and returns a closure through an api call. The host runs each of them inside `context.scope()`
 * (partial and full isolation) and `context.run()`: directly, as a method, from a timer, a promise reaction and an
 * event listener the host starts inside the flow, and the returned closure.
 *
 * Each write is made two ways: to `self.vault.token` (another module's node) and to `self.slothlet.leakMark` (the
 * framework's namespace, which only the host may change, also with the permission system off). The expected answer is
 * the reference one: the same write made by the module's own export in the same flow. Inside `run()` and a partial
 * scope it is also exactly what the same code answers outside any flow, since the flow gives module code the host's
 * context data and not the host's standing. A host closure inside the flow keeps the host's authority.
 */

import path from "node:path";
import { EventEmitter } from "node:events";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";

const ROOT = path.join(process.cwd(), "tmp", "host-flow-module-code-matrix");

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
	write("api/vault.mjs", ['export const token = "SECRET";', "export function ping() {", '\treturn "pong";', "}"]);
	write("plug/evil.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"// The write, to another module's node or to the framework's namespace; its outcome as a string.",
		"const attempt = (value, target) => {",
		"\ttry {",
		'\t\tif (target === "ns") self.slothlet.leakMark = value;',
		"\t\telse self.vault.token = value;",
		'\t\treturn "ok";',
		"\t} catch (error) {",
		"\t\treturn error?.code ?? String(error);",
		"\t}",
		"};",
		"export function direct(value, target) {",
		"\treturn attempt(value, target);",
		"}",
		"export function leak() {",
		"\tglobalThis.__slothletLeakFn = (value, target) => attempt(value, target);",
		"\tglobalThis.__slothletLeakObj = {",
		"\t\tset(value, target) {",
		"\t\t\treturn attempt(value, target);",
		"\t\t}",
		"\t};",
		"\treturn true;",
		"}",
		"export function handout() {",
		"\treturn (value, target) => attempt(value, target);",
		"}"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis.__slothletLeakFn;
	delete globalThis.__slothletLeakObj;
});

const CONFIGS = [];
for (const runtime of ["async", "live"]) {
	for (const mode of ["eager", "lazy"]) {
		for (const permissions of ["on", "off", "omitted"]) CONFIGS.push({ runtime, mode, permissions });
	}
}

/**
 * The flows the host opens.
 * @type {Record<string, function(object, Function): Promise<*>>}
 */
const FLOWS = {
	partial: (api, fn) => api.slothlet.context.scope({ context: { user: "root" }, isolation: "partial", fn }),
	full: (api, fn) => api.slothlet.context.scope({ context: { user: "root" }, isolation: "full", fn }),
	run: (api, fn) => api.slothlet.context.run({ user: "root" }, fn)
};

/**
 * The routes module code reaches the host by, each run by the host's code.
 * @type {Record<string, function(string, string, {handout: Function}): (string|Promise<string>)>}
 */
const ROUTES = {
	globalFunction: (value, target) => globalThis.__slothletLeakFn(value, target),
	globalMethod: (value, target) => globalThis.__slothletLeakObj.set(value, target),
	hostTimer: (value, target) => new Promise((resolve) => setTimeout(() => resolve(globalThis.__slothletLeakFn(value, target)), 1)),
	hostPromise: (value, target) => Promise.resolve(value).then((v) => globalThis.__slothletLeakFn(v, target)),
	hostListener: (value, target) =>
		new Promise((resolve) => {
			const emitter = new EventEmitter();
			emitter.on("go", (v) => resolve(globalThis.__slothletLeakFn(v, target)));
			setImmediate(() => emitter.emit("go", value));
		}),
	handout: (value, target, { handout }) => handout(value, target)
};

/**
 * Whether an outcome is a refusal.
 * @param {string} outcome - `"ok"` or an error code.
 * @returns {boolean} True when refused.
 */
const refused = (outcome) => outcome !== "ok";

/**
 * Build an instance for a configuration, with the module mounted at `plug` and its functions left out.
 * @param {{runtime: string, mode: string, permissions: string}} config - The configuration.
 * @returns {Promise<{api: object, handout: Function}>} The api and the closure the module returned.
 */
async function make({ runtime, mode, permissions }) {
	const api = await slothlet({
		base: path.join(ROOT, "api"),
		runtime,
		mode,
		silent: true,
		...(permissions === "omitted" ? {} : { permissions: { mode: permissions, policy: "allow", rules: [] } })
	});
	await api.slothlet.api.add(["plug"], path.join(ROOT, "plug"));
	await api.plug.evil.leak();
	const handout = await api.plug.evil.handout();
	return { api, handout };
}

/**
 * What a write landed as on the live instance.
 * @param {object} api - The api.
 * @param {string} target - `"vault"` or `"ns"`.
 * @returns {*} The value now there.
 */
const landed = (api, target) => (target === "ns" ? api.slothlet.leakMark : api.vault.token);

describe.each(CONFIGS)("Permissions > module code in a host flow ($runtime, $mode, permissions $permissions)", (config) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	describe.each(["vault", "ns"])("writing %s", (target) => {
		it.each(Object.keys(FLOWS))("inside %s, every route answers as the module's own write", async (flowName) => {
			const made = await make(config);
			api = made.api;
			const flow = FLOWS[flowName];

			// Reference: the module's own export makes the same write in the same flow.
			const referenceMark = `${flowName}:direct`;
			const reference = await flow(api, () => api.plug.evil.direct(referenceMark, target));
			const referencePersisted = landed(api, target) === referenceMark;

			for (const [routeName, route] of Object.entries(ROUTES)) {
				const mark = `${flowName}:${routeName}`;
				const outcome = await flow(api, () => route(mark, target, made));
				const persisted = landed(api, target) === mark;
				const label = `${routeName} in ${flowName}`;
				expect({ label, refused: refused(outcome), persisted }).toEqual({
					label,
					refused: refused(reference),
					persisted: referencePersisted
				});
				// The framework's namespace refuses module code with one code wherever it runs.
				if (target === "ns") expect({ label, outcome }).toEqual({ label, outcome: reference });
				// Outside full isolation, the flow changes nothing about the answer: it is what the same code answers with no
				// flow at all.
				if (flowName !== "full") {
					const bareMark = `bare:${flowName}:${routeName}`;
					const bare = await route(bareMark, target, made);
					expect({ label, outcome }).toEqual({ label, outcome: bare });
				}
			}
		});
	});

	describe.each(["vault", "ns"])("the host's own closure writing %s", (target) => {
		/**
		 * The host's own write through `self`.
		 * @param {string} value - The value written.
		 * @returns {string} `"ok"` or the error code.
		 */
		const hostWrite = (value) => {
			try {
				if (target === "ns") self.slothlet.leakMark = value;
				else self.vault.token = value;
				return "ok";
			} catch (error) {
				return error?.code ?? String(error);
			}
		};

		it("keeps the host's authority inside run() and a partial scope, and its write persists", async () => {
			api = (await make(config)).api;
			for (const flowName of ["partial", "run"]) {
				const mark = `host:${flowName}`;
				const outcome = await FLOWS[flowName](api, () => hostWrite(mark));
				expect({ flowName, outcome, landed: landed(api, target) }).toEqual({ flowName, outcome: "ok", landed: mark });
			}
		});

		it("keeps the host's authority inside a full scope, and its write stays in the scope", async () => {
			api = (await make(config)).api;
			const before = landed(api, target);
			const inside = await FLOWS.full(api, () => hostWrite("host:full"));
			expect(inside).toBe("ok");
			expect(landed(api, target)).toBe(before);
		});
	});
});
