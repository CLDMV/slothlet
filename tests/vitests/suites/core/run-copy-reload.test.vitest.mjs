/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-copy-reload.test.vitest.mjs
 *	@Date: 2026-11-17T18:39:14-08:00 (1794969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T18:56:50-08:00 (1794970610)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()` keeps the copy of the instance it started with across a full reload: its calls
 * (synchronous, after an `await`, through `self`, and from work it left behind) run the api tree, hooks, metadata and
 * permission rules and mode the instance had when the run started. The reload swaps in its new copy for everything
 * else: calls made outside any run after the swap, and runs started after it, use the new copy. A nested run copies
 * from its parent run. A failed reload changes nothing for anyone.
 *
 * Fixture (written at run time): `calls/calls.mjs`, whose leaves answer the copy number `globalThis[COPY]` held when the
 * file loaded, as does `other/other.mjs`; `vault/secret.mjs`, mounted at `vault` with `api.add()` as a module of its own.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { copyForRun, CURRENT_COPY, RUN_COPY } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-copy-reload");
const BASE = path.join(ROOT, "api");
const VAULT = path.join(ROOT, "vault");
const COPY = Symbol.for("slothlet.test.run-copy-reload.copy");
const FAIL = Symbol.for("slothlet.test.run-copy-reload.fail");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "bad"), { recursive: true });
	mkdirSync(path.join(BASE, "other"), { recursive: true });
	writeFileSync(
		path.join(BASE, "other", "other.mjs"),
		'export const copy = globalThis[Symbol.for("slothlet.test.run-copy-reload.copy")];\nexport function copyOf() {\n\treturn copy;\n}\n'
	);
	mkdirSync(VAULT, { recursive: true });
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		[
			'import { self, context } from "@cldmv/slothlet/runtime";',
			'const copy = globalThis[Symbol.for("slothlet.test.run-copy-reload.copy")];',
			"export function copyOf() {",
			"\treturn copy;",
			"}",
			"export function viaSelf() {",
			"\treturn self.calls.copyOf();",
			"}",
			"export async function viaSelfAfter(hold) {",
			"\tawait hold;",
			"\treturn { own: copy, viaSelf: self.calls.copyOf(), user: context.user ?? null };",
			"}",
			"export function secretVia() {",
			"\treturn self.vault.secret();",
			"}",
			"export function copyWhen(ready, done) {",
			"\tconst handle = setInterval(() => {",
			"\t\tif (!ready()) return;",
			"\t\tclearInterval(handle);",
			"\t\tdone({ own: copy, viaSelf: self.calls.copyOf(), user: context.user ?? null });",
			"\t}, 5);",
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(BASE, "bad", "bad.mjs"),
		[
			'if (globalThis[Symbol.for("slothlet.test.run-copy-reload.fail")]) throw new Error("bad.mjs refuses to load");',
			"export function ping() {",
			'\treturn "pong";',
			"}",
			""
		].join("\n")
	);
	writeFileSync(path.join(VAULT, "secret.mjs"), 'export function secret() {\n\treturn "secret";\n}\n');
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[COPY];
	delete globalThis[FAIL];
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

/**
 * Open a run and hold it until `step` resolves, reading the instance before and after. The test does what it likes
 * (a reload) while the run waits.
 * @param {object} api - The instance's api.
 * @param {Function} read - What the run reads, `(phase) => value`, synchronously and after an `await`.
 * @returns {{waiting: Promise<void>, go: Function, result: Promise<object>}} The run.
 */
function heldRun(api, read) {
	const entered = gate();
	const step = gate();
	const result = api.slothlet.context.run({ user: "alice" }, async () => {
		const before = await read("before");
		entered.release();
		await step.promise;
		const after = read("after");
		await null;
		const afterAwait = await read("afterAwait");
		return { before, after: await after, afterAwait };
	});
	result.catch(() => {});
	return { waiting: entered.promise, go: step.release, result };
}

describe.each([["async"], ["live"]])("a run keeps its copy across a reload — %s runtime", (runtime) => {
	describe.each([["none"], ["off"], ["on"]])("permissions %s", (mode) => {
		/**
		 * Make an instance on the copy numbered 1, with `vault` mounted.
		 * @param {object} [config] - More config.
		 * @returns {Promise<object>} The api.
		 */
		async function make(config = {}) {
			globalThis[COPY] = 1;
			const api = await slothlet({
				base: BASE,
				runtime,
				mode: "eager",
				silent: true,
				hook: { enabled: true },
				...(mode === "none" ? {} : { permissions: mode }),
				...config
			});
			await api.slothlet.api.add("vault", VAULT, { id: "vault" });
			return api;
		}

		it("calls in a run started before the reload answer from the old copy; calls outside from the new one", async () => {
			const api = await make();
			try {
				const run = heldRun(api, async () => ({ own: api.calls.copyOf(), viaSelf: api.calls.viaSelf() }));
				await run.waiting;
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				expect(api.calls.copyOf()).toBe(2);
				expect(api.calls.viaSelf()).toBe(2);
				run.go();
				const seen = await run.result;
				expect(seen).toEqual({
					before: { own: 1, viaSelf: 1 },
					after: { own: 1, viaSelf: 1 },
					afterAwait: { own: 1, viaSelf: 1 }
				});
				expect(api.calls.copyOf()).toBe(2);
				// A run started after the swap takes the new copy.
				expect(await api.slothlet.context.run({ user: "bob" }, () => api.calls.viaSelf())).toBe(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a call in flight across a reload reaches the old copy through self", async () => {
			const api = await make();
			try {
				const hold = gate();
				const pending = api.slothlet.context.run({ user: "alice" }, () => api.calls.viaSelfAfter(hold.promise));
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				hold.release();
				expect(await pending).toEqual({ own: 1, viaSelf: 1, user: "alice" });
				expect(api.calls.viaSelf()).toBe(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("work a run left behind (a host timer, a module's interval) calls the old copy after the reload", async () => {
			const api = await make();
			try {
				let reloaded = false;
				const host = gate();
				const own = gate();
				await api.slothlet.context.run({ user: "alice" }, () => {
					const handle = setInterval(() => {
						if (!reloaded) return;
						clearInterval(handle);
						host.release({ own: api.calls.copyOf(), viaSelf: api.calls.viaSelf(), user: api.slothlet.context.get().user });
					}, 5);
					api.calls.copyWhen(() => reloaded, own.release);
				});
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				reloaded = true;
				expect(await host.promise).toEqual({ own: 1, viaSelf: 1, user: "alice" });
				expect(await own.promise).toEqual({ own: 1, viaSelf: 1, user: "alice" });
				expect(api.calls.viaSelf()).toBe(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a nested run copies from its parent run; runs started after the swap nest on the new copy", async () => {
			const api = await make();
			try {
				const run = heldRun(api, (phase) =>
					phase === "before"
						? api.calls.viaSelf()
						: api.slothlet.context.run({ user: "carol" }, async () => {
								await null;
								return { viaSelf: api.calls.viaSelf(), user: api.slothlet.context.get().user };
							})
				);
				await run.waiting;
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				const after = api.slothlet.context.run({ user: "bob" }, () =>
					api.slothlet.context.run({ user: "dave" }, async () => {
						await null;
						return api.calls.viaSelf();
					})
				);
				run.go();
				expect(await run.result).toEqual({
					before: 1,
					after: { viaSelf: 1, user: "carol" },
					afterAwait: { viaSelf: 1, user: "carol" }
				});
				expect(await after).toBe(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a run from before two reloads keeps the first copy; one from between them keeps the second", async () => {
			const api = await make();
			try {
				const first = heldRun(api, () => api.calls.viaSelf());
				await first.waiting;
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				const second = heldRun(api, () => api.calls.viaSelf());
				await second.waiting;
				globalThis[COPY] = 3;
				await api.slothlet.reload();
				expect(api.calls.viaSelf()).toBe(3);
				first.go();
				second.go();
				expect(await first.result).toEqual({ before: 1, after: 1, afterAwait: 1 });
				expect(await second.result).toEqual({ before: 2, after: 2, afterAwait: 2 });
				expect(api.calls.viaSelf()).toBe(3);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a failed reload leaves runs and the instance on the copy they had", async () => {
			const api = await make();
			try {
				const run = heldRun(api, () => api.calls.viaSelf());
				await run.waiting;
				globalThis[COPY] = 2;
				globalThis[FAIL] = true;
				await expect(api.slothlet.reload()).rejects.toThrow("bad.mjs refuses to load");
				delete globalThis[FAIL];
				expect(api.calls.viaSelf()).toBe(1);
				run.go();
				expect(await run.result).toEqual({ before: 1, after: 1, afterAwait: 1 });
				expect(api.calls.viaSelf()).toBe(1);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("hooks and metadata the instance changes after the swap do not reach a run from before it", async () => {
			const api = await make();
			try {
				const hookId = api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}!`);
				api.slothlet.metadata.set("calls", { team: "core" });
				const run = heldRun(api, () => ({ value: api.calls.viaSelf(), team: api.slothlet.metadata.get(api.calls.copyOf).team }));
				await run.waiting;
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				// Carried into the new copy, then changed there.
				expect(api.calls.viaSelf()).toBe("2!");
				api.slothlet.hook.off(hookId);
				api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}?`);
				api.slothlet.metadata.set("calls", { team: "edge" });
				expect(api.calls.viaSelf()).toBe("2?");
				expect(api.slothlet.metadata.get(api.calls.copyOf).team).toBe("edge");
				run.go();
				const seen = await run.result;
				expect(seen).toEqual({
					before: { value: "1!", team: "core" },
					after: { value: "1!", team: "core" },
					afterAwait: { value: "1!", team: "core" }
				});
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	it("in lazy mode, a run from before the reload keeps the old tree, and can still reach its nodes not loaded yet", async () => {
		globalThis[COPY] = 1;
		const api = await slothlet({ base: BASE, runtime, mode: "lazy", silent: true });
		try {
			const run = heldRun(api, async (phase) =>
				phase === "before" ? await api.calls.viaSelf() : { calls: await api.calls.viaSelf(), other: typeof (await api.other.copyOf()) }
			);
			await run.waiting;
			globalThis[COPY] = 2;
			await api.slothlet.reload();
			expect(await api.calls.viaSelf()).toBe(2);
			run.go();
			// `other` was never loaded by the old copy: reached first after the reload, it loads the file as it is then.
			expect(await run.result).toEqual({ before: 1, after: { calls: 1, other: "number" }, afterAwait: { calls: 1, other: "number" } });
		} finally {
			await api.slothlet.shutdown();
		}
	});

	describe("permission rules and mode", () => {
		/**
		 * Make an instance on the copy numbered 1, with `vault` mounted.
		 * @param {string} mode - The permission mode.
		 * @returns {Promise<object>} The api.
		 */
		async function make(mode) {
			globalThis[COPY] = 1;
			const api = await slothlet({ base: BASE, runtime, mode: "eager", silent: true, permissions: { mode } });
			await api.slothlet.api.add("vault", VAULT, { id: "vault" });
			return api;
		}

		it("a rule the instance removes after the swap still holds for a run from before it", async () => {
			const api = await make("on");
			try {
				const ruleId = api.slothlet.permissions.rules.add({ caller: "calls.**", target: "vault.secret", effect: "deny" });
				const run = heldRun(api, () => outcome(() => api.calls.secretVia()));
				await run.waiting;
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				expect(await outcome(() => api.calls.secretVia())).toBe("PERMISSION_DENIED");
				api.slothlet.permissions.rules.remove(ruleId);
				expect(await outcome(() => api.calls.secretVia())).toBe("secret");
				run.go();
				expect(await run.result).toEqual({ before: "PERMISSION_DENIED", after: "PERMISSION_DENIED", afterAwait: "PERMISSION_DENIED" });
				expect(await outcome(() => api.calls.secretVia())).toBe("secret");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("the mode the instance switches to after the swap does not reach a run from before it", async () => {
			const api = await make("off");
			try {
				api.slothlet.permissions.rules.add({ caller: "calls.**", target: "vault.secret", effect: "deny" });
				const run = heldRun(api, () => outcome(() => api.calls.secretVia()));
				await run.waiting;
				globalThis[COPY] = 2;
				await api.slothlet.reload();
				api.slothlet.permissions.control.mode("on");
				expect(await outcome(() => api.calls.secretVia())).toBe("PERMISSION_DENIED");
				run.go();
				expect(await run.result).toEqual({ before: "secret", after: "secret", afterAwait: "secret" });
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});

describe("each run gets a copy record of its own", () => {
	it("two runs started on the same copy get distinct records reading through to it; a nested run derives from its parent", () => {
		const token = { values: null };
		const instance = { [CURRENT_COPY]: () => token };
		const one = copyForRun(instance, null);
		const two = copyForRun(instance, { [RUN_COPY]: null });
		expect(one).not.toBe(two);
		expect(one.from).toBe(token);
		expect(two.from).toBe(token);
		const nested = copyForRun(instance, { [RUN_COPY]: one });
		expect(nested).not.toBe(one);
		expect(nested.from).toBe(token);
		expect(nested.parent).toBe(one);
		expect(copyForRun({}, null)).toBe(null);
	});
});

/**
 * Two concurrent runs never share a writable copy: a hook or metadata one run sets shows neither in the other run nor
 * on the instance. Writes inside a run still reach the instance's shared components until runs fork on their first
 * write, so these are marked as failing for now; they are meant to pass as plain tests once that lands.
 */
describe.each([["async"], ["live"]])("concurrent runs each see their own state — %s runtime", (runtime) => {
	/**
	 * Run `a` and `b` side by side, `a` writing once both have started, `b` reading after the write.
	 * @param {object} api - The instance's api.
	 * @param {Function} write - What run `a` changes.
	 * @param {Function} read - What run `b` and the instance read.
	 * @returns {Promise<{a: *, b: *, instance: *}>} What each saw after the write.
	 */
	async function sideBySide(api, write, read) {
		const bothIn = gate();
		const written = gate();
		let started = 0;
		const enter = () => {
			started++;
			if (started === 2) bothIn.release();
			return bothIn.promise;
		};
		const a = api.slothlet.context.run({ user: "a" }, async () => {
			await enter();
			write();
			written.release();
			await null;
			return read();
		});
		const b = api.slothlet.context.run({ user: "b" }, async () => {
			await enter();
			await written.promise;
			return read();
		});
		const [seenA, seenB] = await Promise.all([a, b]);
		return { a: seenA, b: seenB, instance: read() };
	}

	it.fails("a hook one run registers fires in that run only", async () => {
		globalThis[COPY] = 1;
		const api = await slothlet({ base: BASE, runtime, mode: "eager", silent: true, hook: { enabled: true } });
		try {
			const seen = await sideBySide(
				api,
				() => api.slothlet.hook.on("calls.copyOf:after", ({ result }) => `${result}!`),
				() => api.calls.viaSelf()
			);
			expect(seen).toEqual({ a: "1!", b: 1, instance: 1 });
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it.fails("metadata one run sets reads in that run only", async () => {
		globalThis[COPY] = 1;
		const api = await slothlet({ base: BASE, runtime, mode: "eager", silent: true });
		try {
			const seen = await sideBySide(
				api,
				() => api.slothlet.metadata.set("calls", { team: "a" }),
				() => api.slothlet.metadata.get(api.calls.copyOf).team ?? null
			);
			expect(seen).toEqual({ a: "a", b: null, instance: null });
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
