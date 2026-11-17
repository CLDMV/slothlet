/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/config-unknown-key.test.vitest.mjs
 *	@Date: 2026-11-16T19:00:38-08:00 (1794884438)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T19:00:38-08:00 (1794884438)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A key the v4 config does not have, at any level, refuses the instance with INVALID_CONFIG_UNKNOWN_KEY:
 * typos and v3 option names alike. Shorthand values of a group and values whose keys are the caller's own pass.
 * @module tests/vitests/suites/config/config-unknown-key
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { assertKnownKeys, CONFIG_SCHEMA } from "#helpers/config-schema";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;

describe.each(["eager", "lazy"])("config > unknown keys (%s)", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["a v3 top-level option", { dir: "./api" }, ["dir"]],
		["a typo", { modes: "lazy" }, ["modes"]],
		["a v3 name inside a group", { permissions: { defaultPolicy: "deny" } }, ["permissions", "defaultPolicy"]],
		["a key two groups down", { api: { collision: { mode: { initial: "merge", apis: "warn" } } } }, ["api", "collision", "mode", "apis"]],
		["a v3 routines flag", { stackRoutines: true }, ["stackRoutines"]]
	])("refuses %s", async (_label, extra, path) => {
		const error = await slothlet({ base: BASE, mode, silent: true, ...extra }).catch((caught) => caught);
		expect(error?.code).toBe("INVALID_CONFIG_UNKNOWN_KEY");
		expect(error.details).toMatchObject({ where: "config", key: path.join("."), path });
		expect(error.hint).toContain("@cldmv/slothlet-migrate");
	});

	it("accepts the shorthand forms of a group and values whose keys are the caller's own", async () => {
		api = await slothlet({
			base: BASE,
			mode,
			silent: true,
			hook: "math.*",
			debug: false,
			permissions: "off",
			api: { collision: "merge" },
			typescript: false,
			tracking: true,
			context: { anything: 1 },
			reference: { anyKey: true },
			metadata: { team: "x" },
			lifecycle: { "impl:warning": () => {} }
		});
		expect(api.math).toBeDefined();
	});

	it("feeds its own normalized config back in on reload and rebuilds from the given one on restart", async () => {
		api = await slothlet({ base: BASE, mode, silent: true, api: { collision: "merge" }, routines: { stack: true } });
		await api.slothlet.reload();
		await api.slothlet.restart();
		expect(api.math).toBeDefined();
	});
});

describe("assertKnownKeys", () => {
	it("names where the key was found", () => {
		expect(() => assertKnownKeys({ nope: 1 }, CONFIG_SCHEMA, "a test")).toThrow(
			expect.objectContaining({ code: "INVALID_CONFIG_UNKNOWN_KEY" })
		);
		const error = (() => {
			try {
				assertKnownKeys({ nope: 1 }, CONFIG_SCHEMA, "a test");
			} catch (caught) {
				return caught;
			}
		})();
		expect(error.details.where).toBe("a test");
	});

	it("leaves a value that is not a plain object alone", () => {
		expect(() => assertKnownKeys([1, 2], CONFIG_SCHEMA, "config")).not.toThrow();
		expect(() => assertKnownKeys(null, CONFIG_SCHEMA, "config")).not.toThrow();
	});
});
