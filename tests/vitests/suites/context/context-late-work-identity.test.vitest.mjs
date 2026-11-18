/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-late-work-identity.test.vitest.mjs
 *	@Date: 2026-11-18T07:00:48-08:00 (1795014048)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T07:07:59-08:00 (1795014479)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Work a module leaves behind in a flow the host opened runs as that module once the flow has returned,
 * and still sees the flow's context, on both runtimes, eager and lazy.
 *
 * @description
 * The host opens a flow with `context.run({ tag: "alice" }, …)`, or emits an event inside one and delivers it later
 * through a strategy. In that flow a module schedules work (a timer, and a promise chain nobody awaits) and returns.
 * The work runs after the flow has returned: it reads `context.tag` and then calls `self.vault.secret()`.
 *
 * Rules: everything allowed except `sub.** → vault.**`. The work `sub` left behind is refused the vault, as `sub`
 * itself is; the same work left by `ok` reads it. Both see "alice", the context of the flow the work was left in.
 *
 * Fixture (written to tmp/): `sub` and `ok` are the same file, `vault.secret()` returns "secret".
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "context-late-work-identity");
const REFUSED = "threw PERMISSION_DENIED";
const PERMISSIONS = { policy: "allow", rules: [{ caller: "sub.**", target: "vault.**", effect: "deny" }] };

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

const LEAVER = [
	'import { self, context } from "@cldmv/slothlet/runtime";',
	"const seen = [];",
	"function attempt(route) {",
	"\tconst tag = context.tag ?? null;",
	"\tseen.push(",
	"\t\t(async () => {",
	"\t\t\ttry {",
	"\t\t\t\treturn { route, tag, value: await self.vault.secret() };",
	"\t\t\t} catch (error) {",
	"\t\t\t\treturn { route, tag, value: `threw ${error?.code ?? error?.message}` };",
	"\t\t\t}",
	"\t\t})()",
	"\t);",
	"}",
	"function leave(prefix) {",
	"\tsetTimeout(() => attempt(`${prefix}timer`), 5);",
	"\t(async () => {",
	"\t\tawait new Promise((resolve) => setTimeout(resolve, 5));",
	"\t\tattempt(`${prefix}promise`);",
	"\t})();",
	"}",
	"export function schedule() {",
	'\tleave("");',
	"}",
	"export function listen(name) {",
	'\treturn self.slothlet.event.on(name, () => leave("listener-")).id;',
	"}",
	"export async function drain() {",
	"\tawait new Promise((resolve) => setTimeout(resolve, 40));",
	"\tconst out = await Promise.all(seen);",
	"\tseen.length = 0;",
	"\treturn out.sort((a, b) => (a.route < b.route ? -1 : 1));",
	"}"
];

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/vault/vault.mjs", ["export function secret() {", '\treturn "secret";', "}"]);
	write("api/sub/sub.mjs", LEAVER);
	write("api/ok/ok.mjs", LEAVER);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const MATRIX = ["live", "async"].flatMap((runtime) => ["eager", "lazy"].map((mode) => ({ runtime, mode })));

/**
 * What the work a module left behind recorded.
 * @param {string} prefix - The route prefix.
 * @param {string} value - What each read of the vault gave.
 * @returns {Array<{route: string, tag: string, value: string}>} The records, in route order.
 */
const expected = (prefix, value) => [
	{ route: `${prefix}promise`, tag: "alice", value },
	{ route: `${prefix}timer`, tag: "alice", value }
];

describe.each(MATRIX)("work a module leaves in a finished flow runs as that module > $runtime / $mode", ({ runtime, mode }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const compose = () => slothlet({ base: path.join(ROOT, "api"), runtime, mode, silent: true, permissions: PERMISSIONS });

	it("work left in a run() the host opened is refused where its module is refused, and sees the run's context", async () => {
		api = await compose();
		await api.slothlet.context.run({ tag: "alice" }, () => {
			api.sub.schedule();
		});
		expect(await api.sub.drain()).toEqual(expected("", REFUSED));
	});

	it("work left in a run() the host opened by a module the rules allow reads the vault, in the run's context", async () => {
		api = await compose();
		await api.slothlet.context.run({ tag: "alice" }, () => {
			api.ok.schedule();
		});
		expect(await api.ok.drain()).toEqual(expected("", "secret"));
	});

	it("work a listener leaves in a delivery made later is refused where its subscriber is refused, in the emit's context", async () => {
		api = await compose();
		const held = [];
		api.slothlet.event.strategy((envelope, listeners) => {
			held.push({ envelope, listeners });
		});
		await api.sub.listen("evt");
		await api.slothlet.context.run({ tag: "alice" }, () => api.slothlet.event.emit("evt", {}));
		expect(held).toHaveLength(1);
		const result = await api.slothlet.event.deliver(held[0].envelope, held[0].listeners[0]);
		expect(result.delivered).toBe(true);
		expect(await api.sub.drain()).toEqual(expected("listener-", REFUSED));
	});

	it("work a listener the rules allow leaves in a delivery made later reads the vault, in the emit's context", async () => {
		api = await compose();
		const held = [];
		api.slothlet.event.strategy((envelope, listeners) => {
			held.push({ envelope, listeners });
		});
		await api.ok.listen("evt");
		await api.slothlet.context.run({ tag: "alice" }, () => api.slothlet.event.emit("evt", {}));
		await api.slothlet.event.deliver(held[0].envelope, held[0].listeners[0]);
		expect(await api.ok.drain()).toEqual(expected("listener-", "secret"));
	});
});
