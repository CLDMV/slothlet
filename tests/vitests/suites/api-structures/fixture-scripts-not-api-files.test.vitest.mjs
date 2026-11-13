/**
 * @fileoverview Child-process scripts at a fixture's root are not api files of that fixture (#759).
 * @description
 * `api_test_host_record_leaf/__probe-records.mjs` and `api_test_stream_plants/__probe.mjs` each build slothlet
 * instances of their own and are run in a child process by their permission tests. The structures test loads every
 * fixture folder from its root, so these scripts are named with the `__` prefix the loader hides
 * (docs/MODULE-STRUCTURE.md): loading the fixture root never runs them as api files.
 * @module tests/vitests/suites/api-structures/fixture-scripts-not-api-files
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const API_TESTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests");

describe.each([
	["api_test_host_record_leaf", "__probe-records.mjs", "probeRecords"],
	["api_test_stream_plants", "__probe.mjs", "probe"]
])("%s's child-process script", (folder, script, leafName) => {
	it.each(["eager", "lazy"])("is not loaded as an api file of the fixture root (%s)", async (mode) => {
		expect(existsSync(path.join(API_TESTS, folder, script))).toBe(true);
		const api = await slothlet({ dir: path.join(API_TESTS, folder), mode, silent: true });
		try {
			const keys = Object.keys(api);
			expect(keys).not.toContain(leafName);
			expect(keys.some((key) => key.toLowerCase().includes("probe"))).toBe(false);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
