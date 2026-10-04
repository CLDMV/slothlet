/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/no-base-directory.test.vitest.mjs
 *	@Date: 2026-09-27T11:44:54-07:00 (1790534694)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:01-07:00 (1791090901)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #471 — an instance (node or browser mode) needs no base directory: with `base` (or its `dir`
 * alias) absent or `null`, the instance composes an empty root with no warning and is built
 * entirely through `api.slothlet.api.add()`. A given-but-unusable base still fails loudly: an
 * empty-string base throws INVALID_CONFIG_DIR_MISSING, a missing path throws, and an existing
 * but empty directory still warns.
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

/** Api keys the framework itself puts on every root (`initialize` is the default routine's root cascade). */
const FRAMEWORK_ROOT_KEYS = new Set(["slothlet", "shutdown", "destroy", "initialize"]);

/**
 * User (non-framework) keys on an api root.
 * @param {object} api - Bound api.
 * @returns {string[]} The keys.
 */
const userKeys = (api) => Object.keys(api).filter((key) => !FRAMEWORK_ROOT_KEYS.has(key));

/**
 * Codes of warnings captured since the last clear.
 * @returns {string[]} Warning codes.
 */
const warningCodes = () => SlothletWarning.captured.map((w) => w.code);

describe.each(getMatrixConfigs())("No base directory (#471) > $name", ({ config }) => {
	let api;

	beforeEach(() => {
		SlothletWarning.suppressConsole = true;
		SlothletWarning.clearCaptured();
	});

	afterEach(async () => {
		SlothletWarning.suppressConsole = false;
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * `config` from the matrix without any base/dir it might carry.
	 * @returns {object} Config with no base.
	 */
	const withoutBase = () => {
		const { base: ___base, dir: ___dir, ...rest } = config;
		return rest;
	};

	it("an instance with no base composes an empty root with no warning", async () => {
		api = await slothlet(withoutBase());
		expect(userKeys(api)).toEqual([]);
		expect(warningCodes()).not.toContain("WARN_DIRECTORY_EMPTY");
	});

	it("`base: null` means the same as omitting it", async () => {
		api = await slothlet({ ...withoutBase(), base: null });
		expect(userKeys(api)).toEqual([]);
	});

	it("the tree is built through api.add — directory and object forms, at a path and at the root", async () => {
		api = await slothlet(withoutBase());
		await api.slothlet.api.add("math", path.join(TEST_DIRS.API_TEST, "math"));
		await api.slothlet.api.add("tools", { exports: { ping: () => "pong" } });
		await api.slothlet.api.add("", { exports: { hello: () => "hi" } });

		expect(await api.math.add(2, 3)).toBe(5);
		expect(await api.tools.ping()).toBe("pong");
		expect(await api.hello()).toBe("hi");
	});

	it("permissions and removal work on an api.add-built tree", async () => {
		api = await slothlet({ ...withoutBase(), permissions: { defaultPolicy: "allow", rules: [] } });
		await api.slothlet.api.add("tools", { exports: { ping: () => "pong" } }, { moduleID: "tools-mod" });
		expect(await api.tools.ping()).toBe("pong");
		expect(await api.slothlet.api.remove("tools-mod")).toBe(true);
		expect(api.tools).toBeUndefined();
	});

	it("reload works on an instance with no base and replays what api.add built", async () => {
		api = await slothlet(withoutBase());
		await api.slothlet.api.add("math", path.join(TEST_DIRS.API_TEST, "math"));
		await api.slothlet.reload();
		expect(await api.math.add(1, 1)).toBe(2);
		await api.slothlet.api.reload(".");
		expect(await api.math.add(2, 2)).toBe(4);
	});

	it("browser mode allows no base too: an empty root built through api.add", async () => {
		api = await slothlet({ ...withoutBase(), platform: "browser" });
		expect(userKeys(api)).toEqual([]);
		await api.slothlet.api.add("tools", { exports: { ping: () => "pong" } });
		expect(await api.tools.ping()).toBe("pong");
	});

	it("an empty-string base is still an error", async () => {
		await expect(slothlet({ ...withoutBase(), base: "" })).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_MISSING" });
	});

	it("a base path that does not exist is still an error", async () => {
		await expect(slothlet({ ...withoutBase(), base: path.join(TEST_DIRS.API_TEST, "does-not-exist-471") })).rejects.toThrow();
	});

	it("an existing but empty base directory still warns", async () => {
		const empty = await makeTestTmpDir("empty-base-471");
		try {
			api = await slothlet({ ...withoutBase(), base: empty });
			expect(warningCodes()).toContain("WARN_DIRECTORY_EMPTY");
		} finally {
			if (api) await api.shutdown();
			api = null;
			(await import("node:fs")).rmSync(empty, { recursive: true, force: true });
		}
	});
});
