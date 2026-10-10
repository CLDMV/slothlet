/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/browser/browser-instance-module-copies.test.vitest.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Browser mode imports each instance's, mount's and reload's own copy of a leaf (#598).
 *
 * @description
 * Node imports every leaf under a per-instance query (`?slothlet_instance=…&module=…&_reload=…`), so
 * each instance, each `api.add()` mount and each reload evaluates its own copy. Browser mode imported
 * the resolved specifier bare, so two instances of one folder shared module state, two mounts of one
 * folder were one module, and a full reload could come back with the cached code. The same query is now
 * appended to a resolved `file:` / `http(s):` URL.
 *
 * Fixture: `api_tests/api_test_browser_instance_query` (`counter.bump` keeps a module-level count).
 *
 * @module tests/vitests/suites/browser/browser-instance-module-copies
 */

import path from "node:path";
import { cpSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
import { withInstanceQuery } from "@cldmv/slothlet/processors/loader";
import { getBrowserMatrixConfigs, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../api_tests/api_test_browser_instance_query");

let MANIFEST;

beforeAll(async () => {
	MANIFEST = await getManifest(ROOT);
});

describe.each(getBrowserMatrixConfigs())(
	"Browser Mode > each instance, mount and reload imports its own copy of a leaf (#598) > $name",
	({ config, name }) => {
		const instances = [];
		let scratchDir = null;

		afterEach(async () => {
			while (instances.length) await instances.pop().shutdown();
			if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
			scratchDir = null;
		});

		/**
		 * Create a browser-mode instance and track it for shutdown.
		 * @param {object} [overrides] - Extra config.
		 * @param {string} [dir] - Base folder.
		 * @param {object} [manifest] - Manifest for that folder.
		 * @returns {Promise<object>} The api.
		 */
		async function create(overrides = {}, dir = ROOT, manifest = MANIFEST) {
			const api = await slothlet({ ...makeBrowserConfig(config, dir, manifest), silent: true, ...overrides });
			instances.push(api);
			return api;
		}

		it("two instances of one folder keep separate module state", async () => {
			const first = await create();
			const second = await create();
			expect(await first.counter.bump()).toBe(1);
			expect(await first.counter.bump()).toBe(2);
			expect(await second.counter.bump()).toBe(1);
		});

		it("two api.add() mounts of one folder are separate modules", async () => {
			const api = await create({ api: { ...config.api, mutations: { add: true, remove: true, reload: true } } });
			await api.slothlet.api.add("left", path.join(ROOT, "counter"));
			await api.slothlet.api.add("right", path.join(ROOT, "counter"));
			expect(await api.left.counter.bump()).toBe(1);
			expect(await api.left.counter.bump()).toBe(2);
			expect(await api.right.counter.bump()).toBe(1);
		});

		it("a full reload picks up a changed file", async () => {
			scratchDir = path.join(process.cwd(), "tmp", `browser-instance-query-598-${name.replace(/[^a-z0-9]+/gi, "-")}`);
			rmSync(scratchDir, { recursive: true, force: true });
			cpSync(ROOT, scratchDir, { recursive: true });
			const manifest = await generateManifest(scratchDir);
			const api = await create({ api: { ...config.api, mutations: { add: true, remove: true, reload: true } } }, scratchDir, manifest);
			expect(await api.counter.version()).toBe("v1");

			const file = path.join(scratchDir, "counter", "counter.mjs");
			writeFileSync(file, readFileSync(file, "utf8").replace('return "v1";', 'return "v2";'));
			await api.slothlet.reload();
			expect(await api.counter.version()).toBe("v2");
		});
	}
);

describe("Browser Mode > the instance query added to a resolved specifier (#598)", () => {
	it("appends instance, module and reload parameters to a file: or http(s): URL, merging an existing query", () => {
		expect(withInstanceQuery("file:///app/api/math.mjs", "i1", null, null)).toBe("file:///app/api/math.mjs?slothlet_instance=i1");
		expect(withInstanceQuery("https://app.test/api/math.mjs?v=3", "i1", "m1", 42)).toBe(
			"https://app.test/api/math.mjs?v=3&slothlet_instance=i1&module=m1&_reload=42"
		);
		expect(withInstanceQuery("http://app.test/api/math.mjs#frag", "i1", "m1", null)).toBe(
			"http://app.test/api/math.mjs?slothlet_instance=i1&module=m1#frag"
		);
	});

	it("leaves bare and import-map specifiers, blob: and data: URLs unchanged", () => {
		expect(withInstanceQuery("@app/api/math", "i1", "m1", 1)).toBe("@app/api/math");
		expect(withInstanceQuery("./math.mjs", "i1", "m1", 1)).toBe("./math.mjs");
		expect(withInstanceQuery("blob:https://app.test/0b5c", "i1", "m1", 1)).toBe("blob:https://app.test/0b5c");
		expect(withInstanceQuery("data:text/javascript,export default 1", "i1", "m1", 1)).toBe("data:text/javascript,export default 1");
	});

	it("leaves a specifier alone with no instance to name, or when it is not a parseable URL", () => {
		expect(withInstanceQuery("file:///app/api/math.mjs", undefined, "m1", 1)).toBe("file:///app/api/math.mjs");
		expect(withInstanceQuery("http://[", "i1", null, null)).toBe("http://[");
	});
});
