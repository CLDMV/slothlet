/**
 * @fileoverview File-level code keeps its own permission path when the api itself is callable.
 *
 * @description
 * A base folder holding a root file with a default function makes `api` a function. Code a file writes outside every
 * export still runs as the file's module path there, in eager and lazy mode alike: a rule naming exactly that path
 * reaches it, and a rule on the file's leaves (`m.*`) does not. Checked for a file named after its folder, whose
 * helper a leaf returns and the host runs, in both runtimes and under both `permissions.attribution` values.
 * @module tests/vitests/suites/permissions/permissions-toplevel-callable-root
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_toplevel_callable_root");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

describe.each(matrix)("file-level code under a callable api > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Run the file-level helper a leaf returned, as the host.
	 * @param {string} caller - The caller pattern of the one deny rule.
	 * @returns {Promise<string>} What the helper read, or the code it was refused with.
	 */
	const runHelper = async (caller) => {
		api = await slothlet({
			base: FIXTURE,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "allow", attribution, rules: [{ caller, target: "vault.**", effect: "deny" }] }
		});
		expect(typeof api).toBe("function");
		const helper = await api.samename.give();
		try {
			return await helper();
		} catch (error) {
			return error.code;
		}
	};

	it("is reached by a rule naming exactly the file's module path", async () => {
		expect(await runHelper("samename")).toBe("PERMISSION_DENIED");
	});

	it("is not reached by a rule on the file's leaves", async () => {
		expect(await runHelper("samename.*")).toBe("SECRET");
	});
});
