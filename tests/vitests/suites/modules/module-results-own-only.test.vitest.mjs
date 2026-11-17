/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/module-results-own-only.test.vitest.mjs
 *	@Date: 2026-11-16T16:56:09-08:00 (1794876969)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T17:14:27-08:00 (1794878067)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `modules.add` mounts only the results this instance's `discover()` returned.
 *
 * A discover result is recognised by identity, not by shape: an object that merely looks like one (a hand-built
 * literal, a spread copy of a real result, or a result another instance discovered) is refused as an invalid
 * argument and nothing mounts. Real results stay frozen, so what `discover()` validated is what mounts.
 *
 * Fixture: `api_tests/api_test_modules_npm` (three modules) and `api_tests/api_test_modules_folder`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, "../../../../api_tests");
const FIX_NPM = path.join(FIXTURE_ROOT, "api_test_modules_npm");
const BAZ_ROOT = path.join(FIX_NPM, "node_modules", "packrat-extension-baz");

/** @type {any[]} */
let instances = [];

afterEach(async () => {
	for (const api of instances) await api.shutdown().catch(() => {});
	instances = [];
});

async function load() {
	const api = await slothlet({
		base: TEST_DIRS.API_TEST,
		mode: "eager",
		runtime: "async",
		silent: true,
		api: { collision: { initial: "merge", api: "merge" } }
	});
	instances.push(api);
	return api;
}

/** A plain object with every field a discover result carries, built by hand. */
function handBuilt(mount = ["handbuilt"]) {
	return {
		package: "@fake/handbuilt",
		folder: BAZ_ROOT,
		mount,
		base: path.join(BAZ_ROOT, "api"),
		manifest: {
			schema: 2,
			version: "1.0.0",
			mount,
			base: "./api",
			permissions: [{ caller: "**", target: "handbuilt.**", effect: "allow" }]
		}
	};
}

describe("modules.add: own discover results only", () => {
	it("refuses a hand-built object and mounts nothing", async () => {
		const api = await load();
		// Not a result this instance returned, so it is read as the options of a discover run, whose keys it doesn't have.
		await expect(api.slothlet.api.modules.add(handBuilt())).rejects.toMatchObject({ code: "INVALID_CONFIG_UNKNOWN_KEY" });
		expect(api.handbuilt).toBeUndefined();
	});

	it("refuses a hand-built object in a batch before mounting any item", async () => {
		const api = await load();
		const found = await api.slothlet.api.modules.discover({ root: FIX_NPM, prefix: "packrat-extension-" });
		await expect(api.slothlet.api.modules.add([found[0], handBuilt()])).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
		expect(api.handbuilt).toBeUndefined();
		expect(api.extensions?.baz).toBeUndefined();
	});

	it("refuses a spread copy of a real result that points somewhere else", async () => {
		const api = await load();
		const found = await api.slothlet.api.modules.discover({ root: FIX_NPM, prefix: "packrat-extension-" });
		const copy = { ...found[0], mount: ["elsewhere"] };
		await expect(api.slothlet.api.modules.add(copy)).rejects.toMatchObject({ code: "INVALID_CONFIG_UNKNOWN_KEY" });
		expect(api.elsewhere).toBeUndefined();
	});

	it("refuses a result another instance discovered", async () => {
		const api = await load();
		const other = await load();
		const found = await other.slothlet.api.modules.discover({ root: FIX_NPM, prefix: "packrat-extension-" });
		await expect(api.slothlet.api.modules.add(found[0])).rejects.toMatchObject({ code: "INVALID_CONFIG_UNKNOWN_KEY" });
		expect(api.extensions?.baz).toBeUndefined();
	});

	it("still refuses a value that is neither a name nor an object", async () => {
		const api = await load();
		await expect(api.slothlet.api.modules.add(42)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
		await expect(api.slothlet.api.modules.add(null)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
	});

	it("mounts a real result from discover(), cache.get() and sort()", async () => {
		const api = await load();
		const mm = api.slothlet.api.modules;
		const found = await mm.discover({ root: FIX_NPM });
		const baz = found.find((r) => r.package === "packrat-extension-baz");
		const fromCache = mm.cache.get().find((r) => r.package === "@org/packrat-driver-foo");
		const sorted = mm.sort(found).find((r) => r.package === "@org/packrat-driver-bar");
		expect((await mm.add(baz)).mount).toEqual(["extensions", "baz"]);
		const batch = await mm.add([fromCache, sorted]);
		expect(batch.map((m) => m.mount.join(".")).sort()).toEqual(["drivers.bar", "drivers.foo"]);
		expect(api.extensions.baz.info).toBeDefined();
	});

	it("keeps a real result as discovered: changes to it don't take, and it mounts where its manifest says", async () => {
		const api = await load();
		const found = await api.slothlet.api.modules.discover({ root: FIX_NPM, prefix: "packrat-extension-" });
		const result = found[0];
		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.mount)).toBe(true);
		expect(Object.isFrozen(result.manifest)).toBe(true);
		expect(Reflect.set(result, "base", path.join(FIX_NPM, "node_modules", "@org", "packrat-driver-foo", "api"))).toBe(false);
		expect(Reflect.set(result, "mount", ["elsewhere"])).toBe(false);
		expect(Reflect.set(result.mount, 0, "elsewhere")).toBe(false);
		expect(Reflect.set(result.manifest, "permissions", [{ caller: "**", target: "**", effect: "allow" }])).toBe(false);
		const mounted = await api.slothlet.api.modules.add(result);
		expect(mounted.mount).toEqual(["extensions", "baz"]);
		expect(api.elsewhere).toBeUndefined();
		expect(result.manifest.permissions).toBeUndefined();
	});
});
