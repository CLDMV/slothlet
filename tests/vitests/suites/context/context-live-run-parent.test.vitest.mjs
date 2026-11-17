/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-run-parent.test.vitest.mjs
 *	@Date: 2026-11-17T11:15:23-08:00 (1794942923)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T11:24:15-08:00 (1794943455)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()` opened while another one waits takes the instance's own context, not the waiting one's.
 *
 * @description
 * The live runtime keeps the active store in one field, which names the store of the last `run()` entered until it
 * returns. A `run()` opened from elsewhere while another `run()` waits at an `await` took that waiting store as its parent:
 * it read the other request's context keys it did not set itself, and `metadata.caller()` inside it reported the other
 * request's call. A new `run()` takes the instance's own store as its parent unless the code opening it is part of the
 * waiting flow: a `run()` nested in another's callback (synchronously or after an `await`) still inherits from it.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "context-live-run-parent");

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
	write("api/admin/admin.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		"export async function work(hold) {",
		"\tawait hold;",
		"\treturn { user: context.user ?? null, token: context.token ?? null };",
		"}"
	]);
	write("api/who/who.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		"export function caller() {",
		"\tconst found = self.slothlet.metadata.caller();",
		'\tconst path = found ? (found.apiPath ?? (Array.isArray(found.path) ? found.path.join(".") : "?")) : null;',
		"\treturn { user: context.user ?? null, token: context.token ?? null, caller: path };",
		"}"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

const CONFIGS = [
	["no permissions config", undefined],
	["permissions off", { mode: "off" }],
	["permissions on", { mode: "on" }]
];

describe.each(CONFIGS)("live runtime > the parent of a run() > %s", (_name, permissions) => {
	let api;
	let release;
	let first;

	beforeAll(async () => {
		api = await slothlet({
			base: path.join(ROOT, "api"),
			runtime: "live",
			silent: true,
			context: { app: "demo" },
			...(permissions ? { permissions } : {})
		});
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	/**
	 * Open a request that holds a call of the instance waiting until released.
	 * @returns {void}
	 */
	function holdRoot() {
		const hold = new Promise((resolve) => (release = resolve));
		first = api.slothlet.context.run({ user: "root", token: "T-root" }, () => api.admin.work(hold));
	}

	afterEach(async () => {
		release?.();
		release = null;
		if (first) expect(await first).toEqual({ user: "root", token: "T-root" });
		first = null;
	});

	it("a run() opened while another run() waits does not see the waiting run()'s keys", async () => {
		holdRoot();
		await tick();
		expect(await api.slothlet.context.run({ user: "mallory" }, () => api.slothlet.context.get())).toEqual({
			app: "demo",
			user: "mallory"
		});
		expect(await api.slothlet.context.scope({ context: { user: "mallory" }, fn: () => api.slothlet.context.get() })).toEqual({
			app: "demo",
			user: "mallory"
		});
	});

	it("a leaf called in it reads its own run()'s context and has the host as its caller", async () => {
		holdRoot();
		await tick();
		expect(await api.slothlet.context.run({ user: "mallory" }, () => api.who.caller())).toEqual({
			user: "mallory",
			token: null,
			caller: null
		});
	});

	it("a run() nested in another run()'s callback still inherits from it, synchronously and after an await", async () => {
		holdRoot();
		await tick();
		const nested = await api.slothlet.context.run({ user: "outer", token: "T-outer" }, () =>
			api.slothlet.context.run({ level: 2 }, () => api.slothlet.context.get())
		);
		expect(nested).toEqual({ app: "demo", user: "outer", token: "T-outer", level: 2 });
		const afterAwait = await api.slothlet.context.run({ user: "outer", token: "T-outer" }, async () => {
			await tick();
			return api.slothlet.context.run({ level: 2 }, () => api.who.caller());
		});
		expect(afterAwait).toEqual({ user: "outer", token: "T-outer", caller: null });
	});
});
