/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/env-snapshot.test.vitest.mjs
 *	@Date: 2026-03-30 00:00:00 -07:00 (1743310800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-30 00:00:00 -07:00 (1743310800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for the `api.slothlet.env` built-in environment snapshot.
 *
 * @description
 * Verifies that `api.slothlet.env` is:
 *
 * - Present on every Slothlet instance.
 * - A frozen, shallow copy of `process.env` captured at `load()` time.
 * - Immutable (direct property assignment is silently ignored in non-strict mode).
 * - Correctly filtered when the `env.include` config option is provided.
 * - Consistent across both eager and lazy modes and both async and live runtimes.
 *
 * Note: `self.slothlet.env` inside a module refers to the same frozen object since
 * `self` is the bound-API proxy wrapping `api`.
 *
 * @module tests/vitests/suites/core/env-snapshot
 */

import { afterEach, describe, expect, it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Shared teardown ──────────────────────────────────────────────────────────

let api;

afterEach(async () => {
	if (api) {
		await api.shutdown().catch(() => {});
		api = null;
	}
});

// ─── Basic presence and shape ─────────────────────────────────────────────────

describe("api.slothlet.env — presence and shape", () => {
	it("exposes api.slothlet.env as a plain object", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		expect(api.slothlet.env).toBeDefined();
		expect(typeof api.slothlet.env).toBe("object");
		expect(api.slothlet.env).not.toBeNull();
	});

	it("is frozen (Object.isFrozen returns true)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		expect(Object.isFrozen(api.slothlet.env)).toBe(true);
	});

	it("attempting to assign a property on env is silently ignored (frozen)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		// Mutating a frozen object in non-strict mode silently fails;
		// in strict mode it throws TypeError.  Either way the value must not change.
		const before = api.slothlet.env.NODE_ENV;
		try {
			api.slothlet.env.NODE_ENV = "mutated";
		} catch (_) {
			// TypeError in strict mode — expected; value still must not change.
		}
		expect(api.slothlet.env.NODE_ENV).toBe(before);
	});
});

// ─── Snapshot content ─────────────────────────────────────────────────────────

describe("api.slothlet.env — snapshot content", () => {
	it("contains the NODE_ENV value that was present when slothlet() was called", async () => {
		// process.env.NODE_ENV is set by the vitest runner to "test".
		const envAtCallTime = process.env.NODE_ENV;

		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		expect(api.slothlet.env.NODE_ENV).toBe(envAtCallTime);
	});

	it("contains keys present in process.env at initialization time", async () => {
		// Inject a test-only key before loading.
		process.env.__SLOTHLET_ENV_TEST__ = "hello-snapshot";

		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		expect(api.slothlet.env.__SLOTHLET_ENV_TEST__).toBe("hello-snapshot");

		// Clean up.
		delete process.env.__SLOTHLET_ENV_TEST__;
	});

	it("snapshot is independent — later mutations to process.env are not reflected", async () => {
		process.env.__SLOTHLET_MUTATION_TEST__ = "original";
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		// Mutate after load.
		process.env.__SLOTHLET_MUTATION_TEST__ = "changed";

		// Snapshot must still hold the value captured at load() time.
		expect(api.slothlet.env.__SLOTHLET_MUTATION_TEST__).toBe("original");

		delete process.env.__SLOTHLET_MUTATION_TEST__;
	});

	it("snapshot does not contain a key that was deleted before load()", async () => {
		const savedVal = process.env.__SLOTHLET_DELETED__;
		delete process.env.__SLOTHLET_DELETED__;

		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		expect(Object.prototype.hasOwnProperty.call(api.slothlet.env, "__SLOTHLET_DELETED__")).toBe(false);

		// Restore if it existed.
		if (savedVal !== undefined) {
			process.env.__SLOTHLET_DELETED__ = savedVal;
		}
	});
});

// ─── env.include allowlist ─────────────────────────────────────────────────────

describe("api.slothlet.env — env.include allowlist filtering", () => {
	it("only captures listed keys when env.include is provided", async () => {
		process.env.__SLOTHLET_INCLUDED__ = "yes";
		process.env.__SLOTHLET_EXCLUDED__ = "no";

		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			env: { include: ["NODE_ENV", "__SLOTHLET_INCLUDED__"] }
		});

		expect(api.slothlet.env.NODE_ENV).toBe(process.env.NODE_ENV);
		expect(api.slothlet.env.__SLOTHLET_INCLUDED__).toBe("yes");
		expect(Object.prototype.hasOwnProperty.call(api.slothlet.env, "__SLOTHLET_EXCLUDED__")).toBe(false);

		delete process.env.__SLOTHLET_INCLUDED__;
		delete process.env.__SLOTHLET_EXCLUDED__;
	});

	it("env.include with a key that does not exist in process.env produces no property", async () => {
		delete process.env.__SLOTHLET_NONEXISTENT__;

		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			env: { include: ["__SLOTHLET_NONEXISTENT__", "NODE_ENV"] }
		});

		expect(Object.prototype.hasOwnProperty.call(api.slothlet.env, "__SLOTHLET_NONEXISTENT__")).toBe(false);
		expect(api.slothlet.env.NODE_ENV).toBe(process.env.NODE_ENV);
	});

	it("env.include with an empty array falls back to full snapshot", async () => {
		process.env.__SLOTHLET_FULL__ = "full-snap";

		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			env: { include: [] }
		});

		// Empty include → normaliseEnv returns null → full snapshot used.
		expect(api.slothlet.env.__SLOTHLET_FULL__).toBe("full-snap");

		delete process.env.__SLOTHLET_FULL__;
	});

	it("env.include: non-string entries are silently ignored", async () => {
		process.env.__SLOTHLET_VALID__ = "kept";

		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			// 42 and null are non-string and should be filtered out by normalizeEnv
			env: { include: ["__SLOTHLET_VALID__", 42, null] }
		});

		expect(api.slothlet.env.__SLOTHLET_VALID__).toBe("kept");

		delete process.env.__SLOTHLET_VALID__;
	});

	it("env config omitted entirely falls back to full snapshot", async () => {
		process.env.__SLOTHLET_OMIT_TEST__ = "present";

		// No `env` key in config at all.
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		expect(api.slothlet.env.__SLOTHLET_OMIT_TEST__).toBe("present");

		delete process.env.__SLOTHLET_OMIT_TEST__;
	});

	it("env.include that is not an array falls back to full snapshot (non-array include)", async () => {
		// When env.include is a string instead of an array, normalizeEnv treats it
		// as missing (Array.isArray returns false → null branch in normalizeEnv).
		// _captureEnvSnapshot then receives null → full snapshot is used.
		process.env.__SLOTHLET_NONARR__ = "here";

		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			// include is a plain string rather than an array — not a valid allowlist
			env: { include: "NODE_ENV" }
		});

		// Full snapshot used, so the key must be present.
		expect(api.slothlet.env.__SLOTHLET_NONARR__).toBe("here");

		delete process.env.__SLOTHLET_NONARR__;
	});
});

// ─── Immutability across reloads ──────────────────────────────────────────────

describe("api.slothlet.env — immutability across reload", () => {
	it("env snapshot is NOT refreshed after api.slothlet.reload()", async () => {
		process.env.__SLOTHLET_RELOAD_TEST__ = "before-reload";

		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			api: { mutations: { reload: true } }
		});

		const snapshotBefore = api.slothlet.env.__SLOTHLET_RELOAD_TEST__;

		// Change process.env then reload.
		process.env.__SLOTHLET_RELOAD_TEST__ = "after-reload";
		await api.slothlet.reload();

		// The snapshot captured at initial load() must remain unchanged.
		expect(api.slothlet.env.__SLOTHLET_RELOAD_TEST__).toBe(snapshotBefore);

		delete process.env.__SLOTHLET_RELOAD_TEST__;
	});
});

// ─── Mode × runtime matrix ────────────────────────────────────────────────────

describe.each([
	{ label: "eager + async", mode: "eager", runtime: "async" },
	{ label: "eager + live", mode: "eager", runtime: "live" },
	{ label: "lazy + async", mode: "lazy", runtime: "async" },
	{ label: "lazy + live", mode: "lazy", runtime: "live" }
])("api.slothlet.env — $label", ({ mode, runtime }) => {
	it("env is a frozen object with at least NODE_ENV captured", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true, mode, runtime });

		expect(Object.isFrozen(api.slothlet.env)).toBe(true);
		expect(typeof api.slothlet.env.NODE_ENV).toBe("string");

		await api.shutdown();
		api = null;
	});
});
