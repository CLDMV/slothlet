/**
 * @fileoverview A base path removed by `remove(apiPath)` stays gone when a later add at that path is removed, and a
 * second add there works as the first did (#799).
 *
 * @description
 * The base contributes `extra` (a file exporting `ping`). `remove("extra")` takes the whole subtree off the api. An
 * add of the same file at `extra` under moduleID `em` is then the only owner of that path, so `remove("em")` removes
 * it (remove-if-sole, RELOAD.md): `extra` is not listed and reads `undefined`. Adding `em` again gives a working
 * `extra.ping()`. The same holds with a full `reload()` between the steps, which replays the removals.
 *
 * Each test writes its own copy of the files under `tmp/test-fixtures/`.
 * @module tests/vitests/suites/api-manager/api-manager-remove-path-then-readd
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_MATRIX } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

// A cold build on a loaded runner can be slow; each test builds one instance and may reload it.
const TIMEOUT = 60_000;

/**
 * Write a file under the scratch directory.
 * @param {string} root - Scratch directory.
 * @param {string} rel - The file, relative to it.
 * @param {string} text - Its content.
 * @returns {void}
 */
function put(root, rel, text) {
	fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
	fs.writeFileSync(path.join(root, rel), text);
}

/**
 * What the api answers about `extra`.
 * @param {object} api - The api.
 * @returns {Promise<{listed: boolean, ping: string}>} Whether `extra` is listed, and what `extra.ping()` returns
 *   (`"absent"` when there is no `extra`).
 */
async function readExtra(api) {
	const listed = Object.keys(api).includes("extra");
	if (api.extra === undefined) return { listed, ping: "absent" };
	await api.extra;
	return { listed, ping: await api.extra.ping() };
}

describe.each(TEST_MATRIX)("remove(apiPath) of a base path, then an add there removed > $name", ({ config }) => {
	let api;
	let root;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		if (root) fs.rmSync(root, { recursive: true, force: true });
		root = null;
	});

	/**
	 * Build the instance: base with `root` and `extra`.
	 * @returns {Promise<string>} The `extra.mjs` file to add later.
	 */
	async function build() {
		root = makeTestTmpDirSync("remove-path-then-readd");
		put(root, "base/root.mjs", `export function hello() { return "hi"; }\n`);
		put(root, "base/extra.mjs", `export function ping() { return "extra"; }\n`);
		api = await slothlet({ ...config, base: path.join(root, "base"), silent: true });
		expect(await readExtra(api)).toEqual({ listed: true, ping: "extra" });
		return path.join(root, "base/extra.mjs");
	}

	it(
		"removing the later add leaves the path gone, and a second add works",
		async () => {
			const file = await build();
			expect(await api.slothlet.api.remove("extra")).toBe(true);
			expect(await readExtra(api)).toEqual({ listed: false, ping: "absent" });

			await api.slothlet.api.add("extra", file, { moduleID: "em" });
			expect(await readExtra(api)).toEqual({ listed: true, ping: "extra" });
			expect(await api.slothlet.api.remove("em")).toBe(true);
			expect(await readExtra(api)).toEqual({ listed: false, ping: "absent" });

			await api.slothlet.api.add("extra", file, { moduleID: "em" });
			expect(await readExtra(api)).toEqual({ listed: true, ping: "extra" });
			expect(await api.slothlet.api.remove("em")).toBe(true);
			expect(await readExtra(api)).toEqual({ listed: false, ping: "absent" });
			expect(await api.root.hello()).toBe("hi");
		},
		TIMEOUT
	);

	it(
		"the same holds with a full reload between the steps",
		async () => {
			const file = await build();
			await api.slothlet.api.remove("extra");
			await api.slothlet.reload();
			expect(await readExtra(api)).toEqual({ listed: false, ping: "absent" });

			await api.slothlet.api.add("extra", file, { moduleID: "em" });
			await api.slothlet.reload();
			expect(await readExtra(api)).toEqual({ listed: true, ping: "extra" });
			await api.slothlet.api.remove("em");
			expect(await readExtra(api)).toEqual({ listed: false, ping: "absent" });
			await api.slothlet.reload();
			expect(await readExtra(api)).toEqual({ listed: false, ping: "absent" });

			await api.slothlet.api.add("extra", file, { moduleID: "em" });
			expect(await readExtra(api)).toEqual({ listed: true, ping: "extra" });
			await api.slothlet.reload();
			expect(await readExtra(api)).toEqual({ listed: true, ping: "extra" });
			expect(await api.root.hello()).toBe("hi");
		},
		TIMEOUT
	);
});
