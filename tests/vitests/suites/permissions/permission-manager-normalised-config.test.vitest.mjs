/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permission-manager-normalised-config.test.vitest.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The permission manager is built from the normalised `permissions` section (#772).
 *
 * `permissions` is normalised once, before the components are built. The manager reads that section, and the config
 * the instance keeps is that same snapshot normalised again, so a raw form never reads one way in the manager and
 * another in the config. Normalising is idempotent, which is what lets the same section be handed on.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { normalizePermissionsConfig } from "@cldmv/slothlet/helpers/config";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const ATTRIBUTIONS = ["precise", "fast"];

/** Raw forms of `permissions` the normaliser rewrites or defaults. */
const RAW_FORMS = [
	["a bare mode string", "disabled", "disabled"],
	["true", true, "on"],
	["false", false, "off"],
	["an empty object", {}, "on"],
	["enabled: false", { enabled: false }, "off"],
	["mode over enabled", { mode: "off", enabled: true }, "off"],
	["audit: true", { audit: true }, "on"],
	["audit: false", { audit: false, mode: "on" }, "on"],
	["a mode with no other field", { mode: "disabled" }, "disabled"]
];

describe.each(CONFIGS)("The permission manager reads the normalised permissions (#772) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount `guest`.
	 * @param {*} permissions - The `permissions` option.
	 * @param {string} attribution - `"precise"` or `"fast"`, set when `permissions` is an object.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(permissions, attribution) {
		const given = permissions !== null && typeof permissions === "object" ? { ...permissions, attribution } : permissions;
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, permissions: given });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
		return api;
	}

	/**
	 * What a module that owns none of the framework's namespace gets writing to it.
	 * @returns {string} `"done"` or the refusal code.
	 */
	const writeNamespace = () => withSuppressedSlothletErrorOutputSync(() => api.guest.x.writeNamespaceMember("normalised", 1));

	describe.each(ATTRIBUTIONS)("attribution %s", (attribution) => {
		it.each(RAW_FORMS)("%s behaves as its normalised form", async (_label, raw, modeName) => {
			await load(raw, attribution);
			const rawMode = api.slothlet.permissions.control.mode;
			const rawWrite = writeNamespace();
			await api.shutdown();

			const normalised = normalizePermissionsConfig(raw);
			await load(normalised, attribution);
			expect(rawMode).toBe(modeName);
			expect(api.slothlet.permissions.control.mode).toBe(modeName);
			expect(rawWrite).toBe(writeNamespace());
			expect(rawWrite).toBe(modeName === "disabled" ? "done" : "PERMISSION_DENIED");
		});

		it("keeps the normalised section across a reload", async () => {
			await load({ audit: true, mode: "on" }, attribution);
			await api.slothlet.reload();
			expect(api.slothlet.permissions.control.mode).toBe("on");
			expect(writeNamespace()).toBe("PERMISSION_DENIED");
		});
	});

	it("reads the raw permissions object once, for one normalisation", async () => {
		const reads = { direct: 0, loaded: 0 };
		const counted = (key) =>
			new Proxy(
				{ mode: "on", rules: [] },
				{
					get(target, name, receiver) {
						if (name === "rules") reads[key] += 1;
						return Reflect.get(target, name, receiver);
					}
				}
			);
		normalizePermissionsConfig(counted("direct"));
		await load(counted("loaded"), "precise");
		expect(reads.direct).toBeGreaterThan(0);
		expect(reads.loaded).toBe(reads.direct);
	});

	it("normalising is idempotent, so the manager and the instance config agree", () => {
		for (const [, raw] of RAW_FORMS) {
			const once = normalizePermissionsConfig(raw);
			expect(normalizePermissionsConfig(once)).toEqual(once);
		}
	});

	it("still reports an invalid value as INVALID_CONFIG", async () => {
		await expect(load({ mode: "sometimes" }, "precise")).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		await expect(load("unknown", "precise")).rejects.toMatchObject({ code: "INVALID_CONFIG" });
	});
});
