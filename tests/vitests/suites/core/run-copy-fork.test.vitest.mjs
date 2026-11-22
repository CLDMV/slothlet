/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-copy-fork.test.vitest.mjs
 *	@Date: 2026-11-17T19:45:22-08:00 (1794973522)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T21:25:20-08:00 (1794979520)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()` has its own copy of the instance's state: its first write to a piece of it (a
 * permission rule, the mode, the seal, a principal, a hook, metadata, an event or lifecycle subscription) forks that
 * piece into the run, and the write stays there. Sibling runs keep theirs apart, a nested run starts from its parent's
 * copy and neither one's later writes reach the other, and the instance's own changes after a run started (a restart
 * among them) never reach that run. A full-isolation scope's `self` reads the instance as of the scope's start.
 *
 * The api tree is copied too: a module a run adds is the run's alone (see the last test, and run-copy-tree).
 *
 * Fixture (written at run time): `calls/calls.mjs` (leaves answering 1, reading through `self`), `data/data.mjs` (a
 * data member `n`), `vault/secret.mjs` mounted at `vault` with `api.add()`, and `extra/extra.mjs` to add in a run.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-copy-fork");
const BASE = path.join(ROOT, "api");
const VAULT = path.join(ROOT, "vault");
const EXTRA = path.join(ROOT, "extra");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "data"), { recursive: true });
	mkdirSync(VAULT, { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export function copyOf() {",
			"\treturn 1;",
			"}",
			"export function viaSelf() {",
			"\treturn self.calls.copyOf();",
			"}",
			"export function secretVia() {",
			"\treturn self.vault.secret();",
			"}",
			"export function selfN() {",
			"\treturn self.data.n;",
			"}",
			"export function setSelfN(value) {",
			"\tself.data.n = value;",
			"\treturn self.data.n;",
			"}",
			""
		].join("\n")
	);
	writeFileSync(path.join(BASE, "data", "data.mjs"), "export const n = 1;\n");
	writeFileSync(path.join(VAULT, "secret.mjs"), 'export function secret() {\n\treturn "secret";\n}\n');
	writeFileSync(path.join(EXTRA, "extra.mjs"), 'export function hello() {\n\treturn "hello";\n}\n');
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * A promise with its resolve function.
 * @returns {{promise: Promise<*>, release: Function}} The gate.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

/**
 * What a call answers: its value, or the code of the error it throws.
 * @param {Function} fn - The call.
 * @returns {Promise<*>} The value or the error code.
 */
async function outcome(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message);
	}
}

describe.each([["async"], ["live"]])("a run's writes fork its own copy — %s runtime", (runtime) => {
	describe.each([["none"], ["off"], ["on"]])("permissions %s", (mode) => {
		/**
		 * Make an instance with hooks on and `vault` mounted.
		 * @returns {Promise<object>} The api.
		 */
		async function make() {
			const api = await slothlet({
				base: BASE,
				runtime,
				mode: "eager",
				silent: true,
				hook: { enabled: true },
				...(mode === "none" ? {} : { permissions: mode })
			});
			await api.slothlet.api.add("vault", VAULT, { id: "vault" });
			return api;
		}

		/**
		 * The state the calling code sees.
		 * @param {object} api - The api.
		 * @param {object} heard - Deliveries per listener, reset by each read.
		 * @returns {Promise<object>} What it sees.
		 */
		async function look(api, heard) {
			for (const key of Object.keys(heard)) heard[key] = 0;
			await api.slothlet.event.emit("ping");
			const meta = api.slothlet.metadata.get(api.calls.copyOf);
			return {
				rules: api.slothlet.permissions.global.rules
					.path("vault.secret")
					.filter((rule) => rule.caller === "calls.**")
					.map((rule) => rule.effect),
				secret: await outcome(() => api.calls.secretVia()),
				hooked: api.calls.viaSelf(),
				team: meta.team ?? null,
				tag: meta.tag ?? null,
				mode: api.slothlet.permissions.control.mode(),
				sealed: api.slothlet.permissions.control.sealed,
				heard: { ...heard }
			};
		}

		it("sibling runs each keep their own rules, mode, seal, principals, hooks, metadata and subscriptions", async () => {
			const api = await make();
			const heard = { a: 0, b: 0, host: 0 };
			api.slothlet.event.on("ping", () => heard.host++);
			try {
				const bothIn = gate();
				const written = { a: gate(), b: gate() };
				const aRead = gate();
				let started = 0;
				const enter = () => {
					if (++started === 2) bothIn.release();
					return bothIn.promise;
				};
				const a = api.slothlet.context.run({ user: "a" }, async () => {
					await enter();
					api.slothlet.permissions.rules.add({ caller: "calls.**", target: "vault.secret", effect: "deny" });
					api.slothlet.permissions.control.mode("on");
					api.slothlet.permissions.principal.register("pa", { key: () => 1, resolve: () => ({}) });
					api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}a`);
					api.slothlet.metadata.set("calls", { team: "a" });
					api.slothlet.metadata.global("tag", "a");
					api.slothlet.event.on("ping", () => heard.a++);
					written.a.release();
					await written.b.promise;
					const seen = await look(api, heard);
					aRead.release();
					return {
						...seen,
						pa: api.slothlet.permissions.principal.unregister("pa"),
						pb: api.slothlet.permissions.principal.unregister("pb")
					};
				});
				const b = api.slothlet.context.run({ user: "b" }, async () => {
					await enter();
					api.slothlet.permissions.principal.register("pb", { key: () => 1, resolve: () => ({}) });
					api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}b`);
					api.slothlet.metadata.set("calls", { team: "b" });
					api.slothlet.event.on("ping", () => heard.b++);
					api.slothlet.permissions.control.seal();
					written.b.release();
					await written.a.promise;
					// One run reads at a time: the delivery counts are shared.
					await aRead.promise;
					const seen = await look(api, heard);
					// Sealed in the run: unregistering is refused there.
					return {
						...seen,
						pa: await outcome(() => api.slothlet.permissions.principal.unregister("pa")),
						pb: await outcome(() => api.slothlet.permissions.principal.unregister("pb"))
					};
				});
				const [seenA, seenB] = await Promise.all([a, b]);
				const startMode = mode === "on" ? "on" : "off";
				expect(seenA).toEqual({
					rules: ["deny"],
					secret: "PERMISSION_DENIED",
					hooked: "1a",
					team: "a",
					tag: "a",
					mode: "on",
					sealed: false,
					heard: { a: 1, b: 0, host: 1 },
					pa: true,
					pb: false
				});
				expect(seenB).toEqual({
					rules: [],
					secret: "secret",
					hooked: "1b",
					team: "b",
					tag: null,
					mode: startMode,
					sealed: true,
					heard: { a: 0, b: 1, host: 1 },
					pa: "PERMISSION_SEALED",
					pb: "PERMISSION_SEALED"
				});
				expect(await look(api, heard)).toEqual({
					rules: [],
					secret: "secret",
					hooked: 1,
					team: null,
					tag: null,
					mode: startMode,
					sealed: false,
					heard: { a: 0, b: 0, host: 1 }
				});
				expect(api.slothlet.permissions.principal.unregister("pa")).toBe(false);
				expect(api.slothlet.permissions.principal.unregister("pb")).toBe(false);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a nested run starts from its parent's copy; neither one's later writes reach the other", async () => {
			const api = await make();
			try {
				const nestedIn = gate();
				const parentWrote = gate();
				const seen = await api.slothlet.context.run({ user: "p" }, async () => {
					api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}!`);
					api.slothlet.metadata.set("calls", { team: "parent" });
					const nested = api.slothlet.context.run({ user: "n" }, async () => {
						const start = { hooked: api.calls.viaSelf(), team: api.slothlet.metadata.get(api.calls.copyOf).team };
						api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}?`);
						api.slothlet.metadata.set("calls", { team: "nested" });
						nestedIn.release();
						await parentWrote.promise;
						return { start, end: { hooked: api.calls.viaSelf(), team: api.slothlet.metadata.get(api.calls.copyOf).team } };
					});
					await nestedIn.promise;
					api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}#`);
					parentWrote.release();
					return { nested: await nested, parent: { hooked: api.calls.viaSelf(), team: api.slothlet.metadata.get(api.calls.copyOf).team } };
				});
				expect(seen).toEqual({
					nested: { start: { hooked: "1!", team: "parent" }, end: { hooked: "1!?", team: "nested" } },
					parent: { hooked: "1!#", team: "parent" }
				});
				expect(api.calls.viaSelf()).toBe(1);
				expect(api.slothlet.metadata.get(api.calls.copyOf).team).toBeUndefined();
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("changes the instance makes after a run started do not reach the run", async () => {
			const api = await make();
			const heard = { host: 0 };
			try {
				const ruleId = api.slothlet.permissions.rules.add({ caller: "calls.**", target: "vault.secret", effect: "deny" });
				const entered = gate();
				const go = gate();
				const run = api.slothlet.context.run({ user: "r" }, async () => {
					entered.release();
					await go.promise;
					return look(api, heard);
				});
				await entered.promise;
				api.slothlet.permissions.rules.remove(ruleId);
				api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}!`);
				api.slothlet.metadata.set("calls", { team: "host" });
				api.slothlet.event.on("ping", () => heard.host++);
				api.slothlet.permissions.control.seal();
				go.release();
				expect(await run).toEqual({
					rules: ["deny"],
					secret: mode === "on" ? "PERMISSION_DENIED" : "secret",
					hooked: 1,
					team: null,
					tag: null,
					mode: mode === "on" ? "on" : "off",
					sealed: false,
					heard: { host: 0 }
				});
				expect(await look(api, heard)).toMatchObject({
					rules: [],
					secret: "secret",
					hooked: "1!",
					team: "host",
					sealed: true,
					heard: { host: 1 }
				});
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a seal and a mode switch inside a run leave the instance as it was", async () => {
			const api = await make();
			try {
				await api.slothlet.context.run({ user: "r" }, () => {
					api.slothlet.permissions.control.mode(mode === "on" ? "off" : "on");
					api.slothlet.permissions.control.seal();
					expect(api.slothlet.permissions.control.sealed).toBe(true);
				});
				expect(api.slothlet.permissions.control.sealed).toBe(false);
				expect(api.slothlet.permissions.control.mode()).toBe(mode === "on" ? "on" : "off");
				expect(typeof api.slothlet.permissions.rules.add({ caller: "calls.**", target: "vault.secret", effect: "allow" })).toBe("string");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("an instance restart does not reach a run open across it", async () => {
			const api = await make();
			try {
				api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}!`);
				api.slothlet.permissions.rules.add({ caller: "calls.**", target: "vault.secret", effect: "deny" });
				const entered = gate();
				const go = gate();
				const run = api.slothlet.context.run({ user: "r" }, async () => {
					entered.release();
					await go.promise;
					// The run keeps its own tree across the restart, with the hooks and rules it had.
					return {
						hooked: api.calls.viaSelf(),
						rules: api.slothlet.permissions.global.rules.path("vault.secret").filter((rule) => rule.caller === "calls.**").length
					};
				});
				await entered.promise;
				await api.slothlet.restart();
				expect(api.calls.viaSelf()).toBe(1);
				expect(api.slothlet.permissions.global.rules.path("vault.secret").filter((rule) => rule.caller === "calls.**").length).toBe(0);
				go.release();
				expect(await run).toEqual({ hooked: "1!", rules: 1 });
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("lifecycle subscriptions made in a run hear the run's events only; the api tree is the run's own", async () => {
			const api = await make();
			const heard = { run: 0, host: 0 };
			try {
				api.slothlet.lifecycle.on("impl:created", () => heard.host++);
				await api.slothlet.context.run({ user: "r" }, async () => {
					api.slothlet.lifecycle.on("impl:created", () => heard.run++);
					await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
				});
				expect(heard.run).toBeGreaterThan(0);
				// The run's copy started with the instance's subscriber.
				expect(heard.host).toBe(heard.run);
				// The run changed a tree of its own: the module it added is not on the instance.
				expect(api.extra).toBeUndefined();
				const before = { ...heard };
				await api.slothlet.api.add("again", EXTRA, { id: "again" });
				expect(heard.run).toBe(before.run);
				expect(heard.host).toBeGreaterThan(before.host);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a full-isolation scope's self reads the values as of its start for what it hasn't written; its own writes stay in the scope", async () => {
			const api = await make();
			try {
				const entered = gate();
				const go = gate();
				const scope = api.slothlet.context.scope({
					context: { user: "s" },
					isolation: "full",
					fn: async () => {
						const first = api.calls.selfN();
						entered.release();
						await go.promise;
						const later = api.calls.selfN();
						const written = api.calls.setSelfN(3);
						return { first, later, written, after: api.calls.selfN() };
					}
				});
				await entered.promise;
				api.data.n = 2;
				go.release();
				expect(await scope).toEqual({ first: 1, later: 1, written: 3, after: 3 });
				expect(api.calls.selfN()).toBe(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
