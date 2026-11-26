/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-json.test.vitest.mjs
 *	@Date: 2026-11-25T01:27:40-08:00 (1795598860)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:13:01-08:00 (1795601581)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `JSON.stringify(self)` from a module (#803) throws what JSON throws for the same data when the error is
 * no refusal: a cycle, a throwing `toJSON`, a throwing `toJSON` getter.
 *
 * Fixtures: `api_tests/api_test_self_write_reach` (base) and its `guest` module, whose `runWithSelf` runs a probe as
 * that module.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothletInstance from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, apiPart } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const PROBE = "slothlet.test.uwa.json.probe";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("JSON.stringify(self) edges — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		delete globalThis[Symbol.for(PROBE)];
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and `guest` with the permission system on, and add `syn` holding `values`.
	 * @param {object} values - What `syn` exports.
	 * @param {object[]} [rules] - Permission rules.
	 * @returns {Promise<object>} The api.
	 */
	async function load(values, rules = []) {
		api = await slothletInstance({
			base: apiPart(FIXTURE),
			mode,
			runtime,
			silent: true,
			permissions: { caller: { provenance: false }, rules }
		});
		await api.slothlet.api.add("guest", apiPart(FIXTURE, "guest"), { id: "guest" });
		await api.slothlet.api.add("syn", values, { id: "syn" });
		return api;
	}

	/**
	 * Write `self` as JSON as the guest module, and report the `syn` part, or what was thrown.
	 * @returns {Promise<object>} `{ syn }` or `{ threw: [name, message] }`.
	 */
	function guestWrites() {
		globalThis[Symbol.for(PROBE)] = (self) => {
			try {
				return { syn: JSON.parse(JSON.stringify(self)).syn };
			} catch (error) {
				return { threw: [error?.name, error?.code ?? error?.message] };
			}
		};
		return withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
	}

	it("throws the TypeError JSON throws for a cycle", async () => {
		const data = { n: 1 };
		data.again = data;
		await load({ data });
		expect(() => JSON.stringify(data)).toThrow(TypeError);
		const written = await guestWrites();
		expect(written.threw[0]).toBe("TypeError");
	});

	it("throws what a toJSON method throws, as JSON does", async () => {
		const data = {
			bad: {
				toJSON() {
					throw new RangeError("from toJSON");
				}
			}
		};
		await load({ data });
		expect(await guestWrites()).toEqual({ threw: ["RangeError", "from toJSON"] });
	});

	it("throws what a toJSON getter throws, as JSON does", async () => {
		const data = {
			bad: {
				get toJSON() {
					throw new RangeError("from the getter");
				}
			}
		};
		await load({ data });
		expect(await guestWrites()).toEqual({ threw: ["RangeError", "from the getter"] });
	});
});
