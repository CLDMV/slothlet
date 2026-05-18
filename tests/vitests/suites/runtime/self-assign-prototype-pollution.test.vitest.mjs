/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-prototype-pollution.test.vitest.mjs
 *	@Date: 2026-05-13T00:00:00-07:00 (1778716800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-13 00:00:00 -07:00 (1778716800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests that `self.<reservedKey> = …` is rejected, preventing
 * prototype pollution of the API tree.
 *
 * `__proto__`, `prototype`, and `constructor` are blocked at every path
 * segment. The guard fires synchronously inside the runtime self set trap,
 * before ownership validation, so the assignment never reaches
 * `parent[finalKey] = …` (which would mutate the JS prototype chain when the
 * value is an object).
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";
import { withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

describe("self.<reservedKey> = ... (prototype pollution guard)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("rejects self.__proto__ = obj from external code (no currentWrapper)", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					self.__proto__ = { hacked: true };
				}).toThrow(/LOOSE_SET_RESERVED_KEY/);
			});
		});

		// Prototype chain of the live api object is unchanged: `hacked` shouldn't appear.
		expect(api.hacked).toBeUndefined();
	});

	it("rejects self.constructor = obj", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					self.constructor = { hacked: true };
				}).toThrow(/LOOSE_SET_RESERVED_KEY/);
			});
		});
	});

	it("rejects self.prototype = obj", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					self.prototype = { hacked: true };
				}).toThrow(/LOOSE_SET_RESERVED_KEY/);
			});
		});
	});

	it("rejects bracket-form self['__proto__'] = obj (covers same trap path with computed key)", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			withSuppressedSlothletErrorOutputSync(() => {
				expect(() => {
					self["__proto__"] = { hacked: true };
				}).toThrow(/LOOSE_SET_RESERVED_KEY/);
			});
		});
	});

	it("permits a sibling write so the segment loop's no-throw arm is exercised by the same fixture", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.bootstrapSibling = "ok";
			expect(self.bootstrapSibling).toBe("ok");
		});
	});
});
