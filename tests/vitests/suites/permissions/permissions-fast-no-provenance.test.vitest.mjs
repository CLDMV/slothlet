/**
 * @fileoverview `attribution: "fast"` with `provenance: false` keeps no author check: every function runs as whoever
 * runs it. `"precise"` with `provenance: false` still knows the author of code a module hands out.
 *
 * @description
 * Fixture `api_test_fast_no_provenance`: `author` is denied the vault and hands out code that reads it (a function
 * returned directly, and one nested in returned data); `runner` is allowed the vault and runs that code.
 *
 * Expected values come from the rule as documented (PERMISSIONS.md, `attribution` and `provenance`):
 *
 * | `attribution` | `provenance`   | The author's code, run by the allowed runner |
 * | ------------- | -------------- | -------------------------------------------- |
 * | `"precise"`   | on (default)   | `PERMISSION_DENIED` (the stack names the author) |
 * | `"fast"`      | on (default)   | `PERMISSION_DENIED` (the stack names the author) |
 * | `"precise"`   | `false`        | `PERMISSION_DENIED` (what the author hands out records it) |
 * | `"fast"`      | `false`        | `"SECRET"` (nothing records the author: the code runs as the runner) |
 *
 * The last row is a deliberate choice of speed over this check; it is the one place the two values of `attribution`
 * refuse different things.
 * @module tests/vitests/suites/permissions/permissions-fast-no-provenance
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_fast_no_provenance");
const RULES = [{ caller: "author.**", target: "vault.**", effect: "deny" }];
const DENIED = "PERMISSION_DENIED";

/**
 * Each configuration and what the author's code answers when the runner runs it.
 * @type {Array<{attribution: string, provenance: boolean, expected: string}>}
 */
const ROWS = [
	{ attribution: "precise", provenance: true, expected: DENIED },
	{ attribution: "fast", provenance: true, expected: DENIED },
	{ attribution: "precise", provenance: false, expected: DENIED },
	{ attribution: "fast", provenance: false, expected: "SECRET" }
];

describe.each([
	["eager", "async"],
	["eager", "live"],
	["lazy", "async"],
	["lazy", "live"]
])("fast attribution with provenance off keeps no author check > %s / %s", (mode, runtime) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	describe.each(ROWS)('attribution "$attribution", provenance $provenance', ({ attribution, provenance, expected }) => {
		/**
		 * Build the instance for this row.
		 * @returns {Promise<void>}
		 */
		async function open() {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				permissions: { defaultPolicy: "allow", attribution, rules: RULES, ...(provenance ? {} : { provenance: false }) }
			});
		}

		it(`a function the author returns directly answers ${expected} when the runner runs it`, async () => {
			await open();
			expect(await api.runner.direct()).toBe(expected);
		});

		it(`a function nested in data the author returns answers ${expected} when the runner runs it`, async () => {
			await open();
			expect(await api.runner.nested()).toBe(expected);
		});

		it("the rule itself holds for each module's own leaf", async () => {
			await open();
			expect(await api.author.own()).toBe(DENIED);
			expect(await api.runner.own()).toBe("SECRET");
		});
	});
});
