/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-teardown-cost.test.vitest.mjs
 *	@Date: 2026-10-16T21:16:51-07:00 (1792210611)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T21:19:58-07:00 (1792210798)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live runtime bookkeeping that must not outlive its instance, and a patch the async
 * runtime does not need (#601 review).
 *
 * A call still suspended when its instance shuts down never settles, so its store has to leave the
 * manager's busy set at cleanup; otherwise every later instance pays a stack read on each identity read.
 * The `Promise.prototype.then` patch pins reactions for the live runtime, and is not installed for an
 * instance on the async runtime, which carries identity through reactions itself.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";

const ROOT = path.join(process.cwd(), "tmp", "context-live-teardown-cost");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "x"), { recursive: true });
	writeFileSync(path.join(ROOT, "x", "x.mjs"), "export async function forever(gate) {\n\tawait gate;\n\treturn 1;\n}\n");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe("Live runtime: teardown and runtime-scoped patches (#601 review)", () => {
	it("an instance shut down with a call still suspended leaves no store behind among the busy ones", async () => {
		const api = await slothlet({ base: ROOT, runtime: "live", mode: "eager", silent: true });
		const manager = resolveWrapper(api.x.forever).slothlet.contextManager;
		const before = manager.suspendedStoreCount;
		api.x.forever(new Promise(() => {}));
		expect(manager.suspendedStoreCount).toBe(before + 1);
		await api.shutdown();
		expect(manager.suspendedStoreCount).toBe(before);
	});

	it("an instance on the async runtime leaves Promise.prototype.then as it found it", async () => {
		const then = Promise.prototype.then;
		const api = await slothlet({ base: ROOT, runtime: "async", mode: "eager", silent: true });
		expect(Promise.prototype.then).toBe(then);
		await api.shutdown();
	});
});
