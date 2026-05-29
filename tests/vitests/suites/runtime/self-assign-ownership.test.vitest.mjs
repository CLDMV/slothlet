/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-ownership.test.vitest.mjs
 *	@Date: 2026-05-12T22:04:02-07:00 (1778648642)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 22:32:56 -07:00 (1778650376)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Stage 2 tests for owner-scoped `self.X = …` writes.
 *
 * A module mounted at apiPath `P` may write `self.P = …` (under its own
 * top-level namespace) but NOT to siblings or to brand-new root keys.
 * External code (no `currentWrapper` in ALS context) is unconstrained for
 * top-level writes — this lets bootstrap code seed shared state.
 *
 * Stage 2 only validates TOP-LEVEL writes that fire the runtime `self` set
 * trap. Deep-path writes like `self.X.foo = …` flow through the wrapper at
 * `self.X` and are addressed in Stage 3 alongside wrap-on-set.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";
import { withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

describe("self.X = ... (Stage 2: ownership)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("allows external code (no currentWrapper) to write at the root", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			// We're directly in user code via slothlet.run — no module currentWrapper.
			self.bootstrapValue = "from-outside";
			expect(self.bootstrapValue).toBe("from-outside");
		});
	});

	it("allows base-module code to write anywhere (endpoint='.' owns the whole tree)", async () => {
		api = await slothlet({ base: "./api_tests/api_test_self_assign", mode: "eager" });

		// `api_test_self_assign` is loaded as the base module, so its
		// endpoint is "." — its functions can write anywhere on the tree.
		const result = await api.owner.writeUnderOwn("rewritten-by-owner");
		expect(result).toBe("rewritten-by-owner");
		expect(api.owner).toBe("rewritten-by-owner");
	});

	it("denies an api.add'd module writing outside its mount point", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });
		await api.slothlet.api.add("ownerNs", "./api_tests/api_test_self_assign", { moduleID: "owner-ns" });

		// owner.writeUnderOwn does `self.owner = …`. Mounted at "ownerNs.owner",
		// the module's endpoint is "ownerNs" → only writes under "ownerNs.*"
		// are allowed. `self.owner` (top-level "owner") is NOT under "ownerNs.*"
		// and is denied. The set trap throws synchronously, so use sync assertions.
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.ownerNs.owner.writeUnderOwn("attempt")).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
	});

	it("allows an api.add'd module to overwrite its own mount-point top-level key", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });
		await api.slothlet.api.add("ownerNs", "./api_tests/api_test_self_assign", { moduleID: "owner-ns" });

		// `overwriteOwnMount("ownerNs", value)` does `self.ownerNs = value`.
		// Caller endpoint is "ownerNs", target is "ownerNs" → isUnderOwn=true → allowed.
		// Exercises setOwnedProperty's success arm of ownership validation.
		const result = await api.ownerNs.owner.overwriteOwnMount("ownerNs", "rewritten");
		expect(result).toBe("rewritten");
		expect(api.ownerNs).toBe("rewritten");
	});

	it("denies an api.add'd module writing to a sibling root namespace", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });
		await api.slothlet.api.add("isolated", "./api_tests/api_test_self_assign", { moduleID: "isolated-mod" });

		// writeOutside attempts `self.intruder = …`. Its module endpoint is
		// "isolated"; "intruder" is not under "isolated.*". DENIED.
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.isolated.owner.writeOutside("nope")).toThrow(/LOOSE_SET_NOT_OWNED/);
		});
		expect(api.intruder).toBeUndefined();
	});
});
