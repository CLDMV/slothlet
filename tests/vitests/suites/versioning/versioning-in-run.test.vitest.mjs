/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-in-run.test.vitest.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:09:22-08:00 (1795536562)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Versioning state is part of a run's own copy: `versioning.default()` and `versioning.metadata.set()`
 * in a run change the run's copy only, the run starts from the instance's versioning state as it is when the run
 * starts, and a run that gets a tree of its own (`api.slothlet.api.add()` in the run) keeps the default and metadata
 * it had. `list()`, `metadata.get()` and routing agree throughout.
 *
 * Fixture: `api_tests/api_test_versioned` (`auth` v1, the explicit default, and v2).
 */
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;
const EXTRA = path.resolve(TEST_DIRS.API_TEST_SELF_WRITE_REACH, "..", "api_test_run_write_copies_extra", "api");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("versioning in a run is the run's own — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load `auth` v1 (default) and v2; no dispatcher, so routing goes to the default.
	 * @returns {Promise<object>} The api.
	 */
	async function load() {
		api = await slothlet({ base: path.join(BASE, "callers"), mode, runtime, silent: true, versioning: { dispatcher: () => null } });
		await api.slothlet.api.add("auth", path.join(BASE, "v1"), { version: { tag: "v1", default: true } });
		await api.slothlet.api.add("auth", path.join(BASE, "v2"), { version: { tag: "v2" } });
		return api;
	}

	/**
	 * What the code running now sees of `auth`'s versioning.
	 * @returns {Promise<object>} The default listed, the version routed to, and v1's note.
	 */
	async function seen() {
		const routed = await api.unversionedCaller.callLogin("u");
		return {
			listed: api.slothlet.versioning.list("auth").default,
			routed: routed.version,
			note: api.slothlet.versioning.metadata.get("auth", "v1").note
		};
	}

	it.each([false, true])("a change in a run stays in the run (tree of its own: %s)", async (fork) => {
		await load();
		const inRun = await api.slothlet.context.run({}, async () => {
			if (fork) await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
			api.slothlet.versioning.default("auth", "v2");
			api.slothlet.versioning.metadata.set("auth", "v1", { note: "from-run" });
			return seen();
		});
		expect(inRun).toEqual({ listed: "v2", routed: "v2", note: "from-run" });
		expect(await seen()).toEqual({ listed: "v1", routed: "v1", note: undefined });
	});

	it("a run starts from the instance's state, and keeps it once it has a tree of its own", async () => {
		await load();
		api.slothlet.versioning.default("auth", "v2");
		api.slothlet.versioning.metadata.set("auth", "v1", { note: "host" });
		const inRun = await api.slothlet.context.run({}, async () => {
			const before = await seen();
			await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
			return { before, after: await seen() };
		});
		expect(inRun.before).toEqual({ listed: "v2", routed: "v2", note: "host" });
		expect(inRun.after).toEqual({ listed: "v2", routed: "v2", note: "host" });
		expect(await seen()).toEqual({ listed: "v2", routed: "v2", note: "host" });
	});

	it("a change the instance makes while a run is open does not reach the run", async () => {
		await load();
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		let ready;
		const started = new Promise((resolve) => (ready = resolve));
		const running = api.slothlet.context.run({}, async () => {
			const before = await seen();
			ready();
			await gate;
			return { before, after: await seen() };
		});
		await started;
		api.slothlet.versioning.default("auth", "v2");
		release();
		const inRun = await running;
		expect(inRun.after).toEqual(inRun.before);
		expect(await seen()).toMatchObject({ listed: "v2", routed: "v2" });
	});
});
