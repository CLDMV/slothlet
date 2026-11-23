/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-node-timers.test.vitest.mjs
 *	@Date: 2026-11-22T17:41:20-08:00 (1795398080)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T17:55:16-08:00 (1795398916)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A callback scheduled through the functions `node:timers` exports runs in the `context.run()` flow it was
 * scheduled in, on both runtimes, as one scheduled through the global functions does.
 *
 * @description
 * The live runtime carries a run into a timer's callback by wrapping the scheduler. `node:timers` exports its own
 * references to the same functions, so `import { setTimeout } from "node:timers"`, the module's default export and
 * `require("node:timers")` have to be wrapped as well, and `node:timers/promises` has to keep the run across its
 * promises. Each case opens two runs one after the other; each callback reports the context it sees.
 *
 * Fixture (written to tmp/): `api/probe/probe.mjs` starts one case and resolves with `context.tag` from its callback.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as namedSetTimeout, setImmediate as namedSetImmediate } from "node:timers";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "context-live-node-timers");

/**
 * The cases the probe module starts, by name.
 * @type {string[]}
 */
const CASES = [
	"setTimeout",
	"setInterval",
	"setImmediate",
	"default.setTimeout",
	"default.setInterval",
	"default.setImmediate",
	"require.setTimeout",
	"require.setImmediate",
	"promises.setTimeout",
	"promises.setImmediate",
	"promises.await",
	"promises.setInterval",
	"promises.scheduler.wait",
	"global.setTimeout"
];

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "api", "probe"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "api", "probe", "probe.mjs"),
		[
			'import { context } from "@cldmv/slothlet/runtime";',
			'import { createRequire } from "node:module";',
			'import timers, { setTimeout as ntSetTimeout, setInterval as ntSetInterval, setImmediate as ntSetImmediate, clearInterval as ntClearInterval } from "node:timers";',
			'import * as timersPromises from "node:timers/promises";',
			'const required = createRequire(import.meta.url)("node:timers");',
			"export function start(kind) {",
			"\treturn new Promise((resolve) => {",
			"\t\tconst read = () => resolve(context.tag ?? null);",
			"\t\tswitch (kind) {",
			'\t\t\tcase "setTimeout": return void ntSetTimeout(read, 1);',
			'\t\t\tcase "setInterval": { const handle = ntSetInterval(() => { ntClearInterval(handle); read(); }, 1); return; }',
			'\t\t\tcase "setImmediate": return void ntSetImmediate(read);',
			'\t\t\tcase "default.setTimeout": return void timers.setTimeout(read, 1);',
			'\t\t\tcase "default.setInterval": { const handle = timers.setInterval(() => { timers.clearInterval(handle); read(); }, 1); return; }',
			'\t\t\tcase "default.setImmediate": return void timers.setImmediate(read);',
			'\t\t\tcase "require.setTimeout": return void required.setTimeout(read, 1);',
			'\t\t\tcase "require.setImmediate": return void required.setImmediate(read);',
			'\t\t\tcase "promises.setTimeout": return void timersPromises.setTimeout(1).then(read);',
			'\t\t\tcase "promises.setImmediate": return void timersPromises.setImmediate().then(read);',
			'\t\t\tcase "promises.await": return void (async () => { await timersPromises.setTimeout(1); read(); })();',
			'\t\t\tcase "promises.setInterval": return void (async () => { for await (const tick of timersPromises.setInterval(1)) { void tick; break; } read(); })();',
			'\t\t\tcase "promises.scheduler.wait": return void timersPromises.scheduler.wait(1).then(read);',
			'\t\t\tcase "global.setTimeout": return void setTimeout(read, 1);',
			"\t\t}",
			"\t});",
			"}"
		].join("\n") + "\n"
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe.each(["live", "async"])("%s runtime: callbacks scheduled through node:timers keep the run", (runtime) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({ base: path.join(ROOT, "api"), runtime, mode: "eager", silent: true, context: { tag: "base" } });
	});

	afterAll(async () => {
		await api?.shutdown();
		api = null;
	});

	it.each(CASES)("module code: %s", async (kind) => {
		const one = await api.slothlet.context.run({ tag: "one" }, () => api.probe.start(kind));
		const two = await api.slothlet.context.run({ tag: "two" }, () => api.probe.start(kind));
		expect([one, two]).toEqual(["one", "two"]);
	});

	it("module code: concurrent runs each read their own", async () => {
		const seen = await Promise.all(
			CASES.flatMap((kind) => [
				api.slothlet.context.run({ tag: "one:" + kind }, () => api.probe.start(kind)),
				api.slothlet.context.run({ tag: "two:" + kind }, () => api.probe.start(kind))
			])
		);
		expect(seen).toEqual(CASES.flatMap((kind) => ["one:" + kind, "two:" + kind]));
	});

	it("host code: a run's callback set through the node:timers named exports", async () => {
		const read = (resolve) => () => resolve(Promise.resolve(api.slothlet.context.get()).then((found) => found?.tag ?? null));
		const viaTimeout = await api.slothlet.context.run({ tag: "one" }, () => new Promise((resolve) => namedSetTimeout(read(resolve), 1)));
		const viaImmediate = await api.slothlet.context.run({ tag: "two" }, () => new Promise((resolve) => namedSetImmediate(read(resolve))));
		expect([viaTimeout, viaImmediate]).toEqual(["one", "two"]);
	});

	it("outside every run, a node:timers callback reads the instance's context", async () => {
		expect(await api.probe.start("setTimeout")).toBe("base");
		expect(await api.probe.start("default.setImmediate")).toBe("base");
	});
});
