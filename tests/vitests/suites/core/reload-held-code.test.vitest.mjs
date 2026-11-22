/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/reload-held-code.test.vitest.mjs
 *	@Date: 2026-11-22T08:39:44-08:00 (1795365584)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T11:46:01-08:00 (1795376761)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code made before a `reload()` / `restart()` and run after it acts on the rebuilt instance, with the
 * context it would have had: a host's `AsyncLocalStorage.snapshot()` or `AsyncResource` made in a run, or a snapshot a
 * module's call made there, reads the run's context; the same made outside any run, and a function a module returned
 * (called outside any run), read the instance's. Both runtimes, both modes, with the permission system absent, off and
 * on. After `shutdown()` a module's code reads no `self`.
 *
 * Fixture (written at run time): `calls/calls.mjs`, whose leaf answers the stamp `shared/stamp.mjs` took when the
 * instance's copy of it loaded (one copy per instance ID), and `probe/probe.mjs`, whose `read()` answers that stamp
 * through `self` with `context.who`, whose `snap()` takes a snapshot and hands out a function that reads the same inside
 * it, whose `later()` hands out a function that reads the same wherever it is called, whose `bound()` hands out a bound
 * function doing the same, and whose `holder()` hands out an object whose method does the same. `fresh/fresh.mjs`
 * answers the stamp taken when that file itself loaded: a run's own reload or restart reads its files again under the
 * instance's ID, so `shared/stamp.mjs` keeps its stamp there and this one tells the run's rebuilt copy.
 *
 * With the permission system on, `restart()` starts the instance over: the modules it replaced have no standing, so
 * everything their code does afterwards through `self` is refused (`PERMISSION_DENIED`), a snapshot their call took,
 * a function, a bound function and a method they handed out alike (docs/PERMISSIONS.md), also when a module of the
 * rebuilt instance is the one that calls it (`relay/relay.mjs`, whose `pass(fn)` calls what it is given). A `restart()`
 * in a `run()` / `scope()` starts the run's copy over the same way, for that run alone: in the run, code its modules
 * handed out before it is refused, while the instance outside keeps what it has; a `reload()` there keeps the run on the
 * same instance, and that code keeps its definer's standing.
 */
import path from "node:path";
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "reload-held-code");
const BASE = path.join(ROOT, "api");
const STAMP = Symbol.for("slothlet.test.reload-held-code.stamp");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "probe"), { recursive: true });
	mkdirSync(path.join(BASE, "relay"), { recursive: true });
	mkdirSync(path.join(BASE, "fresh"), { recursive: true });
	mkdirSync(path.join(ROOT, "shared"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "shared", "stamp.mjs"),
		'export const stamp = globalThis[Symbol.for("slothlet.test.reload-held-code.stamp")];\n'
	);
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		'import { stamp } from "../../shared/stamp.mjs";\nexport function copyOf() {\n\treturn stamp;\n}\n'
	);
	writeFileSync(path.join(BASE, "relay", "relay.mjs"), "export async function pass(fn) {\n\treturn fn();\n}\n");
	writeFileSync(
		path.join(BASE, "fresh", "fresh.mjs"),
		'const stamp = globalThis[Symbol.for("slothlet.test.reload-held-code.stamp")];\nexport function loaded() {\n\treturn stamp;\n}\n'
	);
	writeFileSync(
		path.join(BASE, "probe", "probe.mjs"),
		[
			'import { AsyncLocalStorage } from "node:async_hooks";',
			'import { self, context } from "@cldmv/slothlet/runtime";',
			"export async function read() {",
			"\treturn { copy: await self.calls.copyOf(), who: context.who ?? null };",
			"}",
			"export function snap() {",
			"\tconst inside = AsyncLocalStorage.snapshot();",
			"\treturn () => inside(async () => ({ copy: await self.calls.copyOf(), who: context.who ?? null }));",
			"}",
			"export function later() {",
			"\treturn async () => ({ copy: await self.calls.copyOf(), who: context.who ?? null });",
			"}",
			"async function readBound(tag) {",
			"\treturn { copy: await self.calls.copyOf(), who: context.who ?? null, tag };",
			"}",
			"export function bound() {",
			'\treturn readBound.bind(null, "bound");',
			"}",
			"export function holder() {",
			"\treturn {",
			"\t\tasync read() {",
			"\t\t\treturn { copy: await self.calls.copyOf(), who: context.who ?? null };",
			"\t\t}",
			"\t};",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[STAMP];
});

/**
 * Let a few macrotasks pass.
 * @returns {Promise<void>}
 */
async function idle() {
	for (let index = 0; index < 4; index++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Make a function that later runs code the way `kind` says.
 * @param {object} api - The api.
 * @param {string} kind - "snapshot", "resource", "module snapshot", "module function", "module bound function" or
 *   "module method".
 * @returns {Promise<function(): Promise<{copy: *, who: string|null}>>} The function.
 */
async function handOut(api, kind) {
	const body = async () => {
		const direct = await api.calls.copyOf();
		const read = await api.probe.read();
		return { copy: direct === read.copy ? direct : { direct, read: read.copy }, who: api.slothlet.context.get().who ?? null };
	};
	if (kind === "snapshot") {
		const inside = AsyncLocalStorage.snapshot();
		return () => inside(body);
	}
	if (kind === "resource") {
		const resource = new AsyncResource("reload-held-code");
		return () => resource.runInAsyncScope(body);
	}
	if (kind === "module snapshot") return api.probe.snap();
	if (kind === "module bound function") {
		const fn = await api.probe.bound();
		return async () => {
			const { tag, ...rest } = await fn();
			return tag === "bound" ? rest : { copy: { tag }, who: null };
		};
	}
	if (kind === "module method") {
		const object = await api.probe.holder();
		return () => object.read();
	}
	return api.probe.later();
}

/**
 * Make the function (in a run, or outside any), reload or restart the instance with a new stamp, then call it outside
 * any run.
 * @param {object} options - What to do.
 * @param {string} options.runtime - "async" or "live".
 * @param {string} options.mode - "eager" or "lazy".
 * @param {string} options.permissions - "none", "off" or "on".
 * @param {string} options.operation - "reload" or "restart".
 * @param {string} options.kind - See {@link handOut}.
 * @param {boolean} options.inRun - Make it in a run (true) or outside any (false).
 * @param {object} [options.permissionsConfig] - The `permissions` config to use instead of `{ mode: permissions }`'s
 *   shorthand (only with `permissions` "on").
 * @param {boolean} [options.callInRun=false] - Call it in a run the host opens after the reload or restart.
 * @param {boolean} [options.passed=false] - Hand it to `relay.pass()` to call, instead of calling it.
 * @returns {Promise<{copy: *, who: string|null}>} What the function answered, or the error code it threw as `copy`.
 */
async function scenario({ runtime, mode, permissions, operation, kind, inRun, permissionsConfig, callInRun = false, passed = false }) {
	globalThis[STAMP] = 1;
	const api = await slothlet({
		base: BASE,
		runtime,
		mode,
		silent: true,
		context: { who: "instance" },
		...(permissions === "none" ? {} : { permissions: permissionsConfig ?? permissions })
	});
	try {
		let handed = null;
		if (inRun) {
			await api.slothlet.context.run({ who: "run" }, async () => {
				handed = await handOut(api, kind);
			});
		} else handed = await handOut(api, kind);
		await idle();
		globalThis[STAMP] = 2;
		await api.slothlet[operation]();
		await idle();
		const call = passed ? () => api.relay.pass(handed) : handed;
		try {
			if (callInRun) return await api.slothlet.context.run({ who: "later run" }, () => call());
			return await call();
		} catch (error) {
			return { copy: error?.code ?? String(error), who: null };
		}
	} finally {
		await api.slothlet.shutdown();
	}
}

/**
 * Make the function in a run, reload or restart in that run with a new stamp, then call it in the run (or in a run
 * opened in it).
 * @param {object} options - What to do.
 * @param {string} options.runtime - "async" or "live".
 * @param {string} options.mode - "eager" or "lazy".
 * @param {string} options.permissions - "none", "off" or "on".
 * @param {string} options.operation - "reload" or "restart".
 * @param {string} options.kind - See {@link handOut}.
 * @param {boolean} [options.passed=false] - Hand it to `relay.pass()` to call in the run, instead of calling it.
 * @param {boolean} [options.handOutside=false] - Also make one outside any run first, called outside after the run.
 * @param {boolean} [options.nested=false] - Call it in a run opened in the run after the reload or restart.
 * @returns {Promise<{inRun: object, fresh: object, outside: *, held?: object}>} What the function answered in the run
 *   (or the error code it threw as `copy`; `shared/stamp.mjs` keeps the stamp it loaded with there), the stamp the run's
 *   rebuilt copy loaded `fresh/fresh.mjs` with, the one the instance answers after the run, and what the function made
 *   outside answered after the run.
 */
async function runScenario({ runtime, mode, permissions, operation, kind, passed = false, handOutside = false, nested = false }) {
	globalThis[STAMP] = 1;
	const api = await slothlet({
		base: BASE,
		runtime,
		mode,
		silent: true,
		context: { who: "instance" },
		...(permissions === "none" ? {} : { permissions })
	});
	try {
		// Every leaf loaded first, so a lazy instance's answers outside the run are of this stamp.
		await api.calls.copyOf();
		await api.fresh.loaded();
		await api.relay.pass(() => null);
		const outsideHanded = handOutside ? await handOut(api, kind) : null;
		const answer = {};
		await api.slothlet.context.run({ who: "run" }, async () => {
			const handed = await handOut(api, kind);
			await idle();
			globalThis[STAMP] = 2;
			await api.slothlet[operation]();
			await idle();
			const call = () => (passed ? api.relay.pass(handed) : handed());
			try {
				answer.inRun = await (nested ? api.slothlet.context.run({ who: "nested" }, call) : call());
			} catch (error) {
				answer.inRun = { copy: error?.code ?? String(error), who: null };
			}
			answer.fresh = { copy: await api.fresh.loaded(), who: (await api.probe.read()).who };
		});
		await idle();
		answer.outside = await api.fresh.loaded();
		if (outsideHanded !== null) {
			try {
				answer.held = await outsideHanded();
			} catch (error) {
				answer.held = { copy: error?.code ?? String(error), who: null };
			}
		}
		return answer;
	} finally {
		await api.slothlet.shutdown();
	}
}

describe.each([["async"], ["live"]])("%s runtime: code made before a reload or restart, run after it", (runtime) => {
	describe.each([["reload"], ["restart"]])("%s()", (operation) => {
		describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
			describe.each([["none"], ["off"], ["on"]])("permissions %s", (permissions) => {
				// The modules a restart replaced are gone with the instance they were in: with the permission system on, the code
				// they made has no standing (docs/PERMISSIONS.md), so everything it does through `self` is refused.
				const refused = operation === "restart" && permissions === "on";
				const MODULE_CODE = [["module function"], ["module bound function"], ["module method"]];
				it.each([["snapshot"], ["resource"]])("a %s made in a run reads the run's context and the rebuilt tree", async (kind) => {
					const answer = await scenario({ runtime, mode, permissions, operation, kind, inRun: true });
					expect(answer).toEqual({ copy: 2, who: "run" });
				});
				it.each([["snapshot"], ["resource"]])(
					"a %s made outside any run reads the instance's context and the rebuilt tree",
					async (kind) => {
						const answer = await scenario({ runtime, mode, permissions, operation, kind, inRun: false });
						expect(answer).toEqual({ copy: 2, who: "instance" });
					}
				);
				it(`a module snapshot made in a run ${refused ? "is refused" : "reads the run's context and the rebuilt tree"}`, async () => {
					const answer = await scenario({ runtime, mode, permissions, operation, kind: "module snapshot", inRun: true });
					expect(answer).toEqual(refused ? { copy: "PERMISSION_DENIED", who: null } : { copy: 2, who: "run" });
				});
				it.each([["module snapshot"], ...MODULE_CODE])(
					`a %s made outside any run ${refused ? "is refused" : "reads the instance's context and the rebuilt tree"}`,
					async (kind) => {
						const answer = await scenario({ runtime, mode, permissions, operation, kind, inRun: false });
						expect(answer).toEqual(refused ? { copy: "PERMISSION_DENIED", who: null } : { copy: 2, who: "instance" });
					}
				);
				it.each(MODULE_CODE)(
					`a %s made in a run, called outside any run, ${refused ? "is refused" : "reads the instance's context and the rebuilt tree"}`,
					async (kind) => {
						const answer = await scenario({ runtime, mode, permissions, operation, kind, inRun: true });
						expect(answer).toEqual(refused ? { copy: "PERMISSION_DENIED", who: null } : { copy: 2, who: "instance" });
					}
				);
				it.each(MODULE_CODE)(
					`a %s called in a run the host opens after it ${refused ? "is refused" : "reads that run's context and the rebuilt tree"}`,
					async (kind) => {
						const answer = await scenario({ runtime, mode, permissions, operation, kind, inRun: false, callInRun: true });
						expect(answer).toEqual(refused ? { copy: "PERMISSION_DENIED", who: null } : { copy: 2, who: "later run" });
					}
				);
			});
			// The definer is told by the frames alone under `attribution: "fast"`, where nothing is wrapped.
			describe.each([["precise"], ["fast"]])("permissions on, attribution %s", (attribution) => {
				const permissionsConfig = { mode: "on", caller: { attribution } };
				it.each([["module function"], ["module bound function"], ["module method"]])(
					`a %s made outside any run ${operation === "restart" ? "is refused" : "reads the instance's context and the rebuilt tree"}`,
					async (kind) => {
						const answer = await scenario({ runtime, mode, permissions: "on", operation, kind, inRun: false, permissionsConfig });
						expect(answer).toEqual(operation === "restart" ? { copy: "PERMISSION_DENIED", who: null } : { copy: 2, who: "instance" });
					}
				);
			});
		});
	});

	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		describe.each([["none"], ["off"], ["on"]])("permissions %s", (permissions) => {
			// Code a module made before a restart, handed to a module of the rebuilt instance that calls it, is still that
			// code: with the permission system on it is refused.
			describe.each([["reload"], ["restart"]])("%s()", (operation) => {
				const refused = operation === "restart" && permissions === "on";
				it.each([["module function"], ["module bound function"], ["module method"]])(
					`a %s passed into another module's call after it ${refused ? "is refused" : "reads the instance's context and the rebuilt tree"}`,
					async (kind) => {
						const answer = await scenario({ runtime, mode, permissions, operation, kind, inRun: false, passed: true });
						expect(answer).toEqual(refused ? { copy: "PERMISSION_DENIED", who: null } : { copy: 2, who: "instance" });
					}
				);
			});
		});
	});

	// A reload or restart asked for in a run rebuilds the run's copy alone. The instance outside keeps its tree.
	describe.each([["reload"], ["restart"]])("%s() in a run", (operation) => {
		describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
			describe.each([["none"], ["off"], ["on"]])("permissions %s", (permissions) => {
				const refused = operation === "restart" && permissions === "on";
				it.each([["snapshot"], ["resource"]])("a %s made in the run before it reads the run's rebuilt copy", async (kind) => {
					const answer = await runScenario({ runtime, mode, permissions, operation, kind });
					expect(answer).toEqual({ inRun: { copy: 1, who: "run" }, fresh: { copy: 2, who: "run" }, outside: 1 });
				});
				it.each([["module snapshot"], ["module function"], ["module bound function"], ["module method"]])(
					`a %s made in the run before it, called in the run, ${refused ? "is refused" : "reads the run's rebuilt copy"}`,
					async (kind) => {
						const answer = await runScenario({ runtime, mode, permissions, operation, kind });
						expect(answer).toEqual({
							inRun: refused ? { copy: "PERMISSION_DENIED", who: null } : { copy: 1, who: "run" },
							fresh: { copy: 2, who: "run" },
							outside: 1
						});
					}
				);
				// A reload keeps the instance: code made in the run before it keeps its definer's standing, also when a module of
				// the rebuilt copy calls it (#916).
				it.each([["module function"], ["module bound function"], ["module method"]])(
					`a %s made in the run before it, passed into another module's call in the run, ${refused ? "is refused" : "reads the run's rebuilt copy"}`,
					async (kind) => {
						const answer = await runScenario({ runtime, mode, permissions, operation, kind, passed: true });
						expect(answer).toEqual({
							inRun: refused ? { copy: "PERMISSION_DENIED", who: null } : { copy: 1, who: "run" },
							fresh: { copy: 2, who: "run" },
							outside: 1
						});
					}
				);
				it.each([["module function"], ["module bound function"], ["module method"]])(
					`a %s made in the run before it, called in a run opened in the run after it, ${refused ? "is refused" : "reads the run's rebuilt copy"}`,
					async (kind) => {
						const answer = await runScenario({ runtime, mode, permissions, operation, kind, nested: true });
						expect(answer).toEqual({
							inRun: refused ? { copy: "PERMISSION_DENIED", who: null } : { copy: 1, who: "nested" },
							fresh: { copy: 2, who: "run" },
							outside: 1
						});
					}
				);
				it.each([["module function"], ["module bound function"], ["module method"]])(
					"a %s the instance's modules handed out outside the run keeps working on the instance",
					async (kind) => {
						const answer = await runScenario({ runtime, mode, permissions, operation, kind, handOutside: true });
						expect(answer.outside).toBe(1);
						expect(answer.held).toEqual({ copy: 1, who: "instance" });
					}
				);
			});
		});
	});

	// A run that rebuilt its copy reads its own tree; a run opened in it reads through it. Code of the rebuilt copy's
	// modules running there is still held to its module's rules.
	describe.each([["eager"], ["lazy"]])("%s mode, a rule denying probe calls", (mode) => {
		describe.each([["reload"], ["restart"]])("%s() in a run", (operation) => {
			it.each([["module function"], ["module bound function"], ["module method"]])(
				"a %s the rebuilt copy handed out, called in a run opened in the run, is refused",
				async (kind) => {
					globalThis[STAMP] = 1;
					const api = await slothlet({
						base: BASE,
						runtime,
						mode,
						silent: true,
						context: { who: "instance" },
						permissions: { mode: "on", rules: [{ caller: "probe.**", target: "calls.**", effect: "deny" }] }
					});
					try {
						let answer = null;
						await api.slothlet.context.run({ who: "run" }, async () => {
							await api.slothlet[operation]();
							const handed = await handOut(api, kind);
							try {
								answer = await api.slothlet.context.run({ who: "nested" }, () => handed());
							} catch (error) {
								answer = { copy: error?.code ?? String(error), who: null };
							}
						});
						expect(answer).toEqual({ copy: "PERMISSION_DENIED", who: null });
					} finally {
						await api.slothlet.shutdown();
					}
				}
			);
		});
	});

	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		describe.each([["none"], ["off"], ["on"]])("permissions %s", (permissions) => {
			it("a module function called after shutdown() reads no self", async () => {
				globalThis[STAMP] = 1;
				const api = await slothlet({
					base: BASE,
					runtime,
					mode,
					silent: true,
					context: { who: "instance" },
					...(permissions === "none" ? {} : { permissions })
				});
				const later = await api.probe.later();
				expect(await later()).toEqual({ copy: 1, who: "instance" });
				await api.slothlet.shutdown();
				await expect(later()).rejects.toMatchObject({ code: "CONTEXT_NOT_ACTIVE_SELF" });
			});
		});
	});
});
