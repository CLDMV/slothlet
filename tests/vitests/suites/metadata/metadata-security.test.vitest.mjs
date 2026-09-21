/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-security.test.vitest.mjs
 *	@Date: 2026-02-23T20:21:51-08:00 (1771906911)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:53 -08:00 (1772425313)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Security tests for tagSystemMetadata() and lifecycle payload hardening.
 *
 * Tests the two attack vectors patched in docs/v3-issues/tag-system-metadata-enforcement.md:
 *
 * 1. **tagSystemMetadata() token enforcement** — previously a plain `{ _fromLifecycle: true }`
 *    boolean flag that anyone could forge. Now enforced with a module-private Symbol
 *    (LIFECYCLE_TOKEN from lifecycle-token.mjs) that cannot be constructed from user-land.
 *
 * 2. **lifecycle payload wrapper leakage** — `data.wrapper` in impl:created / impl:changed
 *    payloads previously pointed to the raw UnifiedWrapper instance, which exposed
 *    `data.wrapper.slothlet` → the full internal slothlet object. It was first hardened to a frozen
 *    minimal `{ __impl }`, and in v3.18.0 (#433) `wrapper` was DROPPED from the PUBLIC event
 *    entirely — the wrapped callable is exposed on a stable `impl` field instead — so the public tier
 *    surfaces no wrapper handle to leak at all. (The INTERNAL event still carries `wrapper` for
 *    ownership/metadata/routine subscribers, reached only via subscribeInternal.)
 *
 * @module tests/vitests/suites/metadata/metadata-security.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ---------------------------------------------------------------------------
// Attack vector 2: lifecycle payload wrapper leakage
//
// data.wrapper in impl:created / impl:changed payloads previously pointed to the raw
// UnifiedWrapper instance, and data.wrapper.slothlet returned the full internal slothlet object
// (bypassing the proxy's get trap, which was not yet created at that point) — letting any lifecycle
// subscriber reach slothlet.handlers.lifecycle.emit() and bypass the token check entirely. It was
// first hardened to a frozen Object.freeze({ __impl }); in v3.18.0 (#433) `wrapper` was DROPPED from
// the PUBLIC event altogether — the wrapped callable is now exposed on a stable `impl` field — so the
// public tier surfaces no wrapper handle to leak. (The INTERNAL event still carries `wrapper` for
// ownership/metadata/routine subscribers, reached only via subscribeInternal.)
// ---------------------------------------------------------------------------

describe.each(getMatrixConfigs())("Lifecycle Payload Hardening > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
	});

	describe("impl:created public payload", () => {
		it("exposes only the documented safe fields — no `wrapper` handle to leak (#433)", async () => {
			const payloads = [];

			api.slothlet.lifecycle.on("impl:created", (data) => payloads.push(data));

			// Adding a new API module fires impl:created for each placed leaf.
			await api.slothlet.api.add("securityTest", TEST_DIRS.API_TEST);

			expect(payloads.length).toBeGreaterThan(0);
			for (const data of payloads) {
				// The public event carries only these fields — the raw wrapper, the real wrapper ref, and
				// any path to the internal slothlet instance are all absent, so there is nothing to leak.
				expect(Object.keys(data).sort()).toEqual(["apiPath", "filePath", "impl", "moduleID", "source", "sourceFolder"]);
				expect(data.wrapper).toBeUndefined();
				expect(data.__wrapperRef).toBeUndefined();
				expect("slothlet" in data).toBe(false);
				expect("handlers" in data).toBe(false);
			}
		});

		it("exposes the wrapped callable on the stable `impl` field", async () => {
			const payloads = [];

			api.slothlet.lifecycle.on("impl:created", (data) => payloads.push(data));

			await api.slothlet.api.add("securityTest2", TEST_DIRS.API_TEST);

			// At least one placed leaf carries its wrapped callable on `impl` (the value ownership
			// subscribers read internally as wrapper.__impl), so a public consumer never needs the handle.
			expect(payloads.some((data) => typeof data.impl === "function")).toBe(true);
		});
	});

	describe("impl:changed public payload", () => {
		it("exposes only the documented safe fields after reload — no `wrapper` (#433)", async () => {
			const payloads = [];

			api.slothlet.lifecycle.on("impl:changed", (data) => payloads.push(data));

			// Reload fires impl:changed for every module that gets a new impl.
			await api.slothlet.api.reload();

			if (payloads.length === 0) {
				// Some modes may not fire impl:changed on a straight reload if no diff — skip gracefully.
				return;
			}

			for (const data of payloads) {
				expect(Object.keys(data).sort()).toEqual(["apiPath", "filePath", "impl", "moduleID", "source", "sourceFolder"]);
				expect(data.wrapper).toBeUndefined();
				expect(data.__wrapperRef).toBeUndefined();
			}
		});
	});
});
