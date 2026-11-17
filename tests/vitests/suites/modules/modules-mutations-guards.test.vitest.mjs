/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/modules-mutations-guards.test.vitest.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:30-08:00 (1794882570)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression tests for `api.slothlet.api.modules.*` mutation
 * guards.
 *
 * The `api.slothlet.api.{add, remove, reload}` mutating methods enforce
 * `config.api.mutations.{add, remove, reload}` and throw
 * `INVALID_CONFIG_MUTATIONS_DISABLED` when the corresponding flag is `false`.
 *
 * The newer `api.slothlet.api.modules.{modules.add, modules.add, modules.add,
 * modules.remove}` methods are mounts/unmounts too — they call through to the
 * same underlying api-manager component-add/component-remove paths — and must
 * enforce the same flags. Pre-fix, the modules.* wrappers passed straight
 * through to `ModuleManager` and the gate never fired, which let a host
 * configured with `mutations.add: false` (or `mutations.remove: false`) still
 * mount and unmount modules via the modules.* namespace, defeating the
 * declared mutation safety boundary.
 *
 * Pre-fix expected failure: modules.add / modules.add / modules.add /
 * modules.remove resolve successfully (or throw an unrelated error) when the
 * corresponding mutation flag is disabled. Post-fix: each rejects with a
 * SlothletError whose code is `INVALID_CONFIG_MUTATIONS_DISABLED`.
 *
 * Read-only methods (`discover`, `sort`, `cache.get`,
 * `cache.clear`, `stale`) are NOT mutations and must NOT
 * fail under disabled flags — covered as sanity checks.
 *
 * @module tests/vitests/suites/modules/modules-mutations-guards.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, "../../../../api_tests");
const FIX_FOLDER = path.join(FIXTURE_ROOT, "api_test_modules_folder");

/** @type {any} */
let api;

afterEach(async () => {
	if (api?.shutdown) {
		await api.shutdown().catch(() => {});
		api = null;
	}
});

/**
 * Boot slothlet with the modules namespace exposed and a per-flag mutations
 * override applied.
 * @param {{add?: boolean, remove?: boolean}} flags
 */
async function bootWithMutations(flags) {
	api = await slothlet({
		base: TEST_DIRS.API_TEST,
		mode: "eager",
		runtime: "async",
		silent: true,
		api: {
			collision: {
				mode: { initial: "merge", api: "merge" }
			},
			mutations: { add: flags.add ?? true, remove: flags.remove ?? true }
		}
	});
	return api.slothlet.api.modules;
}

describe("api.slothlet.api.modules.* — mutation guards", () => {
	// ─── modules.add / modules.add / modules.add → gated by mutations.add ────

	it("modules.add(name) throws INVALID_CONFIG_MUTATIONS_DISABLED when mutations.add is false", async () => {
		const mm = await bootWithMutations({ add: false });
		const [first] = await mm.discover({ root: FIX_FOLDER });
		expect(first?.package).toBeTypeOf("string");

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.add(first)).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
	});

	it("modules.add([...]) throws INVALID_CONFIG_MUTATIONS_DISABLED when mutations.add is false", async () => {
		const mm = await bootWithMutations({ add: false });
		const found = await mm.discover({ root: FIX_FOLDER });
		expect(found.length).toBeGreaterThan(0);

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.add(found)).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
	});

	it("modules.add() throws INVALID_CONFIG_MUTATIONS_DISABLED when mutations.add is false (transitive via modules.add)", async () => {
		const mm = await bootWithMutations({ add: false });

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.add({ discover: { root: FIX_FOLDER } })).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
	});

	// ─── modules.remove → gated by mutations.remove ──────────────────────────

	it("modules.remove(name) throws INVALID_CONFIG_MUTATIONS_DISABLED when mutations.remove is false", async () => {
		// Mount the module first while mutations.add is allowed so modules.remove
		// has something to operate on. Bring up a separate instance because the
		// mutations config is locked at init.
		const setupApi = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true,
			api: {
				collision: {
					mode: { initial: "merge", api: "merge" }
				},
				mutations: { add: true, remove: true }
			}
		});
		try {
			const setupMm = setupApi.slothlet.api.modules;
			const [first] = await setupMm.discover({ root: FIX_FOLDER });
			expect(first?.package).toBeTypeOf("string");
		} finally {
			await setupApi.shutdown?.().catch(() => {});
		}

		// Now boot the real test instance with remove disabled and a mounted
		// module to operate against. (Mounting succeeds because mutations.add
		// is still true — the gate fires when modules.remove is called.)
		const mm = await bootWithMutations({ add: true, remove: false });
		const [first] = await mm.discover({ root: FIX_FOLDER });
		await mm.add(first);

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.remove(first.package)).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
	});

	// ─── Read-only methods are NOT mutations and must NOT throw ────────────

	it("discover / sort / cache.get / cache.clear / stale do NOT throw under disabled mutations", async () => {
		const mm = await bootWithMutations({ add: false, remove: false });

		// All read-only methods must succeed even with both mutation flags off.
		const found = await mm.discover({ root: FIX_FOLDER });
		expect(Array.isArray(found)).toBe(true);

		const sorted = mm.sort(found);
		expect(Array.isArray(sorted)).toBe(true);

		const cache = mm.cache.get();
		expect(Array.isArray(cache)).toBe(true);

		mm.cache.clear();
		expect(mm.cache.get().length).toBe(0);

		const stale = mm.stale();
		expect(Array.isArray(stale)).toBe(true);
	});

	// ─── Control: when flags are enabled, mounts/unmounts work as normal ────

	it("modules.add + modules.remove succeed when both mutation flags are enabled (control)", async () => {
		const mm = await bootWithMutations({ add: true, remove: true });
		const [first] = await mm.discover({ root: FIX_FOLDER });
		expect(first?.package).toBeTypeOf("string");

		// Both calls must resolve without throwing the mutation-disabled guard.
		await mm.add(first);
		const removed = await mm.remove(first.package);
		expect(removed).toBe(true);
	});
});
