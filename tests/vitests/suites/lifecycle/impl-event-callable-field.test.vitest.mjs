/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/impl-event-callable-field.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #433 — the PUBLIC `impl:created` / `impl:changed` events expose the leaf's callable on
 * a stable `impl` field again, and no longer re-expose the reserved internal `wrapper.__impl` handle.
 *
 * @description
 * #398 correctly stopped the public tier from carrying the RAW unwrapped impl, but between 3.16.2 and
 * 3.17.0 the wrapped callable was reachable only via the reserved internal `wrapper.__impl` handle —
 * a public subscriber reading the pre-3.17 `e.impl` field silently got `undefined`. The fix (#433)
 * restores a stable public `impl` field holding the wrapped callable and DROPS `wrapper` from the
 * public event (it was redundant with `impl` and re-exposed an internal name). The internal tier still
 * carries `wrapper` for ownership/metadata/routine subscribers; the payload-hardening guarantees for
 * that live in the metadata-security suite.
 *
 * @module tests/vitests/suites/lifecycle/impl-event-callable-field.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Lifecycle > public impl event callable field (#433) > $name", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
	});

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("impl:created exposes the wrapped callable on a stable public `impl` field", async () => {
		const created = [];
		api.slothlet.lifecycle.on("impl:created", (data) => created.push(data));
		await api.slothlet.api.add("impl433a", TEST_DIRS.API_TEST);

		expect(created.length).toBeGreaterThan(0);
		// `impl` is a documented public key on every payload (null before a lazy wrapper materializes).
		for (const data of created) expect("impl" in data).toBe(true);
		// At least one placed leaf carries its callable there — the field a pre-3.17 consumer reads.
		expect(created.some((data) => typeof data.impl === "function")).toBe(true);
	});

	it("drops the internal `wrapper` handle from the public event (reads go through `impl`)", async () => {
		const created = [];
		api.slothlet.lifecycle.on("impl:created", (data) => created.push(data));
		await api.slothlet.api.add("impl433b", TEST_DIRS.API_TEST);

		expect(created.length).toBeGreaterThan(0);
		for (const data of created) {
			// #433: the reserved wrapper.__impl handle is no longer re-exposed publicly; `impl` replaces it.
			expect(data.wrapper).toBeUndefined();
			expect(data.__wrapperRef).toBeUndefined();
		}
	});

	it("impl:changed also carries the stable public `impl` field and no `wrapper`", async () => {
		const changed = [];
		api.slothlet.lifecycle.on("impl:changed", (data) => changed.push(data));
		await api.slothlet.api.reload();

		if (changed.length === 0) return; // some modes fire no impl:changed on a diff-free reload — skip gracefully
		for (const data of changed) {
			expect("impl" in data).toBe(true);
			expect(data.wrapper).toBeUndefined();
		}
	});
});
