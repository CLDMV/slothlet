/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-reserved-name.test.vitest.mjs
 *	@Date: 2026-05-14T00:00:00-07:00 (1778803200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-14 00:00:00 -07:00 (1778803200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests that `self.<reservedName> = …` and self assignments with
 * empty path segments are rejected.
 *
 * `setOwnedProperty` delegates path validation to `normalizeApiPath`, the same
 * normalizer used by api.add / api.remove. That gate rejects reserved root
 * names (`slothlet`, top-level `shutdown` / `destroy`) and empty path segments
 * (`"a..b"`). Without it, `self.slothlet = "evil"` would overwrite the
 * built-in namespace and brick the instance.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";
import { withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

describe("self.<reservedName> = ... (normalizeApiPath gate)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("rejects self.slothlet = … (would overwrite the built-in namespace)", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					self.slothlet = "evil";
				}).toThrow(/INVALID_CONFIG_API_PATH_INVALID|RESERVED_NAME/);
			});
		});

		// Built-in namespace still works after the rejected attempt.
		expect(typeof api.slothlet.shutdown).toBe("function");
	});

	it("rejects self.shutdown = …", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					self.shutdown = "evil";
				}).toThrow(/INVALID_CONFIG_API_PATH_INVALID|RESERVED_NAME/);
			});
		});
	});

	it("rejects self.destroy = …", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					self.destroy = "evil";
				}).toThrow(/INVALID_CONFIG_API_PATH_INVALID|RESERVED_NAME/);
			});
		});
	});

	it("rejects bracket-form keys with empty segments (e.g. self['a..b'])", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					self["a..b"] = "v";
				}).toThrow(/INVALID_CONFIG_API_PATH_INVALID|EMPTY_SEGMENTS/);
			});
		});
	});
});
