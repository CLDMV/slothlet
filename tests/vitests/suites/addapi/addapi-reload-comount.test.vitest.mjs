/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/addapi/addapi-reload-comount.test.vitest.mjs
 *	@Date: 2026-09-28T21:57:05-07:00 (1790657825)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:55-07:00 (1791090895)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Scoped reload of one module keeps a co-mounted module's leaves (#525).
 *
 * @description
 * Two modules added at the same api path (`plugins`) with different moduleIDs (`ext`, `other`)
 * share one namespace wrapper. `api.slothlet.api.reload("ext")` must rebuild only `ext`'s
 * contribution: every leaf `other` mounted there stays reachable (with the same reference), and
 * the reverse holds for `reload("other")`, with the namespace's key order unchanged. A name both
 * modules export keeps the value the adds resolved it to. The reloaded module's own contribution is
 * still rebuilt from disk — a changed leaf picks up its new code and a deleted file's leaf goes away.
 * Also covered: a callable namespace (a module whose default export flattens onto the mount),
 * user-set values on the namespace, and a reload with ownership tracking unavailable.
 *
 * The split by contributor applies at every depth: `plugins.tools` and `plugins.tools.net` are
 * subfolders both modules contribute to, so a reload rebuilds the reloaded module's leaves inside
 * them and keeps the other's (same references, same key order); `plugins.tools.net.ping`, which both
 * export, follows the ownership stack. A subfolder only the other module contributes
 * (`plugins.tools.kit`) is kept whole and, under lazy mode, is not materialized by the reload.
 * Last, a leaf an overriding module won keeps reverting to the first module's code on remove after
 * either module reloads.
 *
 * Runs across the full matrix (eager/lazy × async/live × hooks on/off).
 *
 * @module tests/vitests/suites/addapi/addapi-reload-comount
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach, vi } from "vitest";
import { cpSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Instance creation plus two adds can exceed the default hook/test timeout on a loaded machine.
vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

const API_TESTS_ROOT = path.dirname(TEST_DIRS.API_TEST);
const EXT_DIR = path.join(API_TESTS_ROOT, "api_test_reload_comount_ext");
const OTHER_DIR = path.join(API_TESTS_ROOT, "api_test_reload_comount_other");
const CALLABLE_DIR = path.join(API_TESTS_ROOT, "api_test_reload_comount_callable");
const REVERT_A_DIR = path.join(API_TESTS_ROOT, "api_test_reload_revert_a");
const REVERT_B_DIR = path.join(API_TESTS_ROOT, "api_test_reload_revert_b");

/** Leaves each module contributes under `api.plugins`, with the value each returns. */
const EXT_LEAVES = {
	alpha: "ext:alpha",
	beta: "ext:beta",
	"tools.hammer": "ext:hammer",
	"tools.saw": "ext:saw",
	"tools.net.http": "ext:http",
	"tools.net.smtp": "ext:smtp"
};
const OTHER_LEAVES = {
	gamma: "other:gamma",
	delta: "other:delta",
	"gear.cog": "other:cog",
	"gear.spring": "other:spring",
	"tools.wrench": "other:wrench",
	"tools.net.dns": "other:dns",
	"tools.net.ntp": "other:ntp",
	"tools.kit.tape": "other:tape",
	"tools.kit.box.nail": "other:nail"
};

/**
 * Resolve a dotted path under `api.plugins`.
 * @param {object} api - Slothlet API proxy.
 * @param {string} dotted - Path relative to `api.plugins`.
 * @returns {*} The value at that path, or undefined.
 */
function at(api, dotted) {
	let cur = api.plugins;
	for (const part of dotted.split(".")) {
		if (cur === undefined || cur === null) return undefined;
		cur = cur[part];
	}
	return cur;
}

/**
 * Assert every listed leaf is callable under `api.plugins` and returns its expected value.
 * @param {object} api - Slothlet API proxy.
 * @param {Record<string, string>} leaves - Map of dotted path → expected return value.
 * @returns {Promise<void>}
 */
async function expectLeaves(api, leaves) {
	for (const [dotted, expected] of Object.entries(leaves)) {
		const fn = at(api, dotted);
		expect(typeof fn, `api.plugins.${dotted}`).toBe("function");
		expect(await fn(), `api.plugins.${dotted}()`).toBe(expected);
	}
}

/**
 * Create an instance with the api collision mode set and every mutation enabled.
 * @param {object} config - Matrix config.
 * @param {string} [collisionApi] - `api.collision.api` to use; the matrix config's when omitted.
 * @returns {Promise<object>} Slothlet API proxy.
 */
async function createInstance(config, collisionApi) {
	const apiConfig = { ...config.api, mutations: { add: true, remove: true, reload: true } };
	if (collisionApi) apiConfig.collision = { ...(config.api?.collision ?? {}), api: collisionApi };
	return slothlet({ ...config, base: TEST_DIRS.API_TEST, api: apiConfig });
}

/**
 * Create an instance with `ext` and `other` co-mounted at `plugins`.
 * @param {object} config - Matrix config.
 * @param {string} extDir - Folder to mount as `ext`.
 * @param {string} extID - moduleID for that folder.
 * @param {object} [options] - Options.
 * @param {string} [options.otherDir] - Folder to mount as `other`.
 * @param {string} [options.collisionApi] - `api.collision.api` to use.
 * @returns {Promise<object>} Slothlet API proxy.
 */
async function createComounted(config, extDir = EXT_DIR, extID = "ext", { otherDir = OTHER_DIR, collisionApi } = {}) {
	const api = await createInstance(config, collisionApi);
	await api.slothlet.api.add("plugins", extDir, { moduleID: extID });
	await api.slothlet.api.add("plugins", otherDir, { moduleID: "other" });
	return api;
}

/**
 * Copy both co-mounted fixtures into a scratch folder so a test can change them on disk.
 * @param {string} scratchDir - Folder to copy into (recreated).
 * @returns {{ extDir: string, otherDir: string }} The copies.
 */
function copyFixtures(scratchDir) {
	rmSync(scratchDir, { recursive: true, force: true });
	const extDir = path.join(scratchDir, "ext");
	const otherDir = path.join(scratchDir, "other");
	cpSync(EXT_DIR, extDir, { recursive: true });
	cpSync(OTHER_DIR, otherDir, { recursive: true });
	return { extDir, otherDir };
}

/**
 * Write a single-function leaf module.
 * @param {string} file - File to write.
 * @param {string} name - Exported function name.
 * @param {string} value - Value the function returns.
 * @returns {void}
 */
function writeLeaf(file, name, value) {
	writeFileSync(file, `export function ${name}() {\n\treturn "${value}";\n}\n`);
}

for (const { config, name } of getMatrixConfigs()) {
	describe(`scoped reload keeps co-mounted modules' leaves (#525) - ${name}`, () => {
		let api;
		let scratchDir = null;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
			if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
			scratchDir = null;
		});

		it("reload('ext') keeps every leaf 'other' mounted at the same path", async () => {
			api = await createComounted(config);
			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
			const keysBefore = Object.keys(api.plugins);

			await api.slothlet.api.reload("ext");

			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
			expect(Object.keys(api.plugins)).toEqual(keysBefore);
		});

		it("reload('other') keeps every leaf 'ext' mounted at the same path", async () => {
			api = await createComounted(config);
			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
			const keysBefore = Object.keys(api.plugins);

			await api.slothlet.api.reload("other");

			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
			expect(Object.keys(api.plugins)).toEqual(keysBefore);
		});

		it("reloading one module leaves the other module's leaf references untouched", async () => {
			api = await createComounted(config);
			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
			const gammaBefore = api.plugins.gamma;
			const gearBefore = api.plugins.gear;

			await api.slothlet.api.reload("ext");

			expect(api.plugins.gamma).toBe(gammaBefore);
			expect(api.plugins.gear).toBe(gearBefore);
			await expectLeaves(api, OTHER_LEAVES);
		});

		it("still rebuilds the reloaded module's own contribution from disk", async () => {
			scratchDir = path.join(process.cwd(), "tmp", `reload-comount-525-${name.replace(/[^a-z0-9]+/gi, "-")}`);
			rmSync(scratchDir, { recursive: true, force: true });
			cpSync(EXT_DIR, scratchDir, { recursive: true });

			api = await createComounted(config, scratchDir);
			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });

			// Change one of ext's leaves and delete another, then reload only ext.
			writeFileSync(path.join(scratchDir, "alpha.mjs"), `export function alpha() {\n\treturn "ext:alpha:v2";\n}\n`);
			unlinkSync(path.join(scratchDir, "beta.mjs"));
			await api.slothlet.api.reload("ext");

			await expectLeaves(api, { alpha: "ext:alpha:v2", "tools.hammer": "ext:hammer", "tools.saw": "ext:saw", ...OTHER_LEAVES });
			expect(api.plugins.beta).toBeUndefined();
		});

		it.each([["ext"], ["other"]])("a name both modules export keeps its resolved value across reload('%s')", async (target) => {
			api = await createComounted(config);
			const sharedBefore = await api.plugins.shared();

			await api.slothlet.api.reload(target);

			expect(await api.plugins.shared()).toBe(sharedBefore);
		});

		it("keeps user-set values on the shared namespace across a scoped reload", async () => {
			api = await createComounted(config);
			api.plugins.flag = 42;
			api.plugins.custom = () => "user:custom";

			await api.slothlet.api.reload("ext");

			expect(api.plugins.flag).toBe(42);
			expect(await api.plugins.custom()).toBe("user:custom");
			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
		});

		it("keeps the co-mounted leaves when ownership tracking is unavailable", async () => {
			api = await createComounted(config);
			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
			const sl = resolveWrapper(api.plugins).slothlet;
			const ownership = sl.handlers.ownership;
			sl.handlers.ownership = null;
			try {
				await api.slothlet.api.reload("ext");
			} finally {
				sl.handlers.ownership = ownership;
			}

			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
		});

		it.each([["callable"], ["other"]])(
			"a callable namespace keeps its callable and the co-mounted leaves across reload('%s')",
			async (target) => {
				api = await createComounted(config, CALLABLE_DIR, "callable");
				expect(await api.plugins()).toBe("callable:main");
				await expectLeaves(api, { extra: "callable:extra", ...OTHER_LEAVES });

				await api.slothlet.api.reload(target);

				expect(await api.plugins()).toBe("callable:main");
				await expectLeaves(api, { extra: "callable:extra", ...OTHER_LEAVES });
			}
		);

		it("a path reload that rebuilds every co-mounted module keeps the callable and every leaf", async () => {
			api = await createComounted(config, CALLABLE_DIR, "callable");
			expect(await api.plugins()).toBe("callable:main");

			await api.slothlet.api.reload("plugins");

			expect(await api.plugins()).toBe("callable:main");
			await expectLeaves(api, { extra: "callable:extra", ...OTHER_LEAVES });
		});

		it("drops the callable when the module that exported it no longer does after its reload", async () => {
			scratchDir = path.join(process.cwd(), "tmp", `reload-comount-525-callable-${name.replace(/[^a-z0-9]+/gi, "-")}`);
			rmSync(scratchDir, { recursive: true, force: true });
			cpSync(CALLABLE_DIR, scratchDir, { recursive: true });

			api = await createComounted(config, scratchDir, "callable");
			expect(await api.plugins()).toBe("callable:main");

			writeFileSync(path.join(scratchDir, "main.mjs"), `export function extra() {\n\treturn "callable:extra:v2";\n}\n`);
			await api.slothlet.api.reload("callable");

			expect(() => api.plugins()).toThrow();
			await expectLeaves(api, OTHER_LEAVES);
		});

		it.each([
			["ext", "tools.net.http", "net/http.mjs", "http", ["tools.net.dns", "tools.wrench", "tools.kit", "gear"]],
			["other", "tools.net.dns", "net/dns.mjs", "dns", ["tools.net.http", "tools.hammer", "alpha"]]
		])(
			"reload('%s') rebuilds its leaves three levels into shared subfolders and keeps the other module's",
			async (target, changedPath, changedFile, changedName, keptPaths) => {
				scratchDir = path.join(process.cwd(), "tmp", `reload-comount-525-deep-${target}-${name.replace(/[^a-z0-9]+/gi, "-")}`);
				const { extDir, otherDir } = copyFixtures(scratchDir);
				api = await createComounted(config, extDir, "ext", { otherDir });
				await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
				const keptRefs = keptPaths.map((p) => at(api, p));
				const orders = ["", "tools", "tools.net"].map((p) => Object.keys(p ? at(api, p) : api.plugins));

				writeLeaf(path.join(target === "ext" ? extDir : otherDir, "tools", changedFile), changedName, `${target}:${changedName}:v2`);
				await api.slothlet.api.reload(target);

				await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES, [changedPath]: `${target}:${changedName}:v2` });
				keptPaths.forEach((p, i) => expect(at(api, p), `api.plugins.${p} reference`).toBe(keptRefs[i]));
				expect(["", "tools", "tools.net"].map((p) => Object.keys(p ? at(api, p) : api.plugins))).toEqual(orders);
			}
		);

		it.each([
			["merge", "ext", "ext"],
			["merge", "other", "ext"],
			["merge-replace", "ext", "other"],
			["merge-replace", "other", "other"]
		])(
			"under %s, a leaf both modules export at depth follows the ownership stack across reload('%s')",
			async (collisionApi, target, owner) => {
				scratchDir = path.join(
					process.cwd(),
					"tmp",
					`reload-comount-525-ping-${collisionApi}-${target}-${name.replace(/[^a-z0-9]+/gi, "-")}`
				);
				const { extDir, otherDir } = copyFixtures(scratchDir);
				api = await createComounted(config, extDir, "ext", { otherDir, collisionApi });
				expect(await api.plugins.tools.net.ping()).toBe(`${owner}:ping`);

				writeLeaf(path.join(extDir, "tools", "net", "ping.mjs"), "ping", "ext:ping:v2");
				writeLeaf(path.join(otherDir, "tools", "net", "ping.mjs"), "ping", "other:ping:v2");
				await api.slothlet.api.reload(target);

				// The owner's leaf is live; it carries new code only when the owner is the module reloaded.
				expect(await api.plugins.tools.net.ping()).toBe(owner === target ? `${owner}:ping:v2` : `${owner}:ping`);
				await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
				const ownership = resolveWrapper(api.plugins).slothlet.handlers.ownership;
				expect(ownership.getCurrentOwner("plugins.tools.net.ping")?.moduleID).toBe(owner);
			}
		);

		it.skipIf(config.mode !== "lazy")("does not materialize the other module's untouched lazy subtrees", async () => {
			api = await createComounted(config);
			const untouched = ["gear", "tools.kit"].map((p) => resolveWrapper(at(api, p)));
			const spies = untouched.map((w) => vi.spyOn(w, "_materialize"));

			await api.slothlet.api.reload("ext");

			spies.forEach((spy, i) => expect(spy, `${["gear", "tools.kit"][i]}._materialize`).not.toHaveBeenCalled());
			await expectLeaves(api, { ...EXT_LEAVES, ...OTHER_LEAVES });
		});

		it.each([
			["merge-replace", ["A", "B"]],
			["merge-replace", ["A"]],
			["forceOverwrite", ["A", "B"]],
			["forceOverwrite", ["A"]]
		])("with B overriding A's leaf (%s), reloading %j then removing B reverts the leaf to A's code", async (how, reloads) => {
			api = await createInstance(config, how === "merge-replace" ? "merge-replace" : undefined);
			await api.slothlet.api.add("leaf", REVERT_A_DIR, { moduleID: "A" });
			await api.slothlet.api.add("leaf", REVERT_B_DIR, { moduleID: "B", ...(how === "forceOverwrite" ? { forceOverwrite: true } : {}) });
			expect(await api.leaf.an()).toBe("B:an");

			for (const id of reloads) await api.slothlet.api.reload(id);
			expect(await api.leaf.an()).toBe("B:an");

			await api.slothlet.api.remove("B");

			expect(await api.leaf.an()).toBe("A:an");
			expect(await api.leaf.am()).toBe("A:am");
			expect(api.leaf.bx).toBeUndefined();
		});
	});
}
