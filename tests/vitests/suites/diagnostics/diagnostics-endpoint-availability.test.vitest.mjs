/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/diagnostics/diagnostics-endpoint-availability.test.vitest.mjs
 *	@Date: 2026-02-21T00:00:00-08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 10:32:24 -08:00 (1771698744)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Verifies the complete endpoint availability of `api.slothlet` under
 * all combinations of `diagnostics` and `hook.enabled` configuration flags.
 *
 * ## What is always present on `api.slothlet` (15 keys)
 *
 * Regardless of diagnostics or hook configuration, these namespaces and values
 * must always be available:
 *
 *   version       — semver string from package.json
 *   instanceID    — unique instance identifier string
 *   types         — TYPE_STATES symbol map ({ UNMATERIALIZED, IN_FLIGHT })
 *   api           — mutation control: { add, remove, reload }
 *   sanitize      — sanitize a string using API path rules
 *   context       — per-request context: { get, diagnostics, run, scope }
 *   hook          — hook registration: { on, remove, clear, off, enable, disable, list }
 *   metadata      — metadata API: { setGlobal, set, remove, setFor, removeFor }
 *   scope         — run a function with current context
 *   run           — run a function with provided context
 *   reload        — reload entire instance
 *   shutdown      — shutdown instance
 *   owner         — ownership query: { get }
 *   materialize   — lazy materialization tracking: { materialized, get, wait }
 *   lifecycle     — lifecycle event emitter: { on, off, subscribe, unsubscribe, emit }
 *
 * ## Only present when `diagnostics: true` (adds `diag`)
 *
 *   diag          — diagnostics namespace:
 *     describe        — list or describe the user-facing API structure
 *     reference       — reference object passed at init (or null)
 *     context         — context object from config
 *     inspect         — returns full getDiagnostics() snapshot
 *     owner           — ownership diagnostics: { get }
 *     caches          — cache diagnostics: { get, getAllModuleIDs, has }
 *     SlothletWarning — SlothletWarning class (for captured-warning access in tests)
 *     hook            — hook manager introspection: { enabled, compilePattern }
 *                       always present (hookManager is always instantiated, even when
 *                       hook.enabled: false — it's just in disabled state)
 *
 * ## Never present (regardless of any config)
 *
 *   hooks (plural) — there is a `delete namespace.hooks` in api_builder.mjs but
 *                    `namespace.hooks` is never assigned, making it a no-op dead code
 *                    path. `api.slothlet.hooks` is always undefined.
 *
 * @see src/lib/builders/api_builder.mjs — namespace construction and conditional logic
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Shared base dir ──────────────────────────────────────────────────────────

const BASE_DIR = TEST_DIRS.API_TEST;

// ─── Always-present top-level keys ───────────────────────────────────────────

/**
 * The complete set of keys that must always be present on `api.slothlet`,
 * regardless of the `diagnostics` or `hook.enabled` configuration.
 * @type {string[]}
 */
const ALWAYS_PRESENT_KEYS = [
	"version",
	"instanceID",
	"types",
	"api",
	"sanitize",
	"context",
	"hook",
	"metadata",
	"scope",
	"run",
	"reload",
	"shutdown",
	"owner",
	"materialize",
	"lifecycle"
];

/**
 * Keys that must NEVER be present on `api.slothlet` regardless of any config.
 * `hooks` (plural) is never assigned to the namespace — `delete namespace.hooks`
 * in api_builder.mjs is a no-op dead code path. The actual hook API is `hook`
 * (singular), which is always present.
 * @type {string[]}
 */
const NEVER_PRESENT_KEYS = ["hooks"];

/**
 * Keys only present when `diagnostics: true`.
 * @type {string[]}
 */
const DIAG_ONLY_KEYS = ["diag"];

// ─── Expected sub-keys ───────────────────────────────────────────────────────

const EXPECTED_API_SUBKEYS = ["add", "remove", "reload"];
const EXPECTED_CONTEXT_SUBKEYS = ["get", "diagnostics", "run", "scope"];
const EXPECTED_HOOK_SUBKEYS = ["on", "remove", "clear", "off", "enable", "disable", "list"];
const EXPECTED_METADATA_SUBKEYS = ["setGlobal", "set", "remove", "setFor", "removeFor"];
const EXPECTED_OWNER_SUBKEYS = ["get"];
const EXPECTED_MATERIALIZE_SUBKEYS = ["materialized", "get", "wait"];
const EXPECTED_LIFECYCLE_SUBKEYS = ["on", "off", "subscribe", "unsubscribe", "emit"];

const EXPECTED_DIAG_SUBKEYS = ["describe", "reference", "context", "inspect", "owner", "caches", "SlothletWarning", "hook"];
const EXPECTED_DIAG_CACHES_SUBKEYS = ["get", "getAllModuleIDs", "has"];
const EXPECTED_DIAG_OWNER_SUBKEYS = ["get"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Assert that all specified keys exist on an object with at minimum a defined value.
 * @param {object} obj - Object to check.
 * @param {string[]} keys - Expected keys.
 * @param {string} [label] - Label for error messages.
 */
function expectKeysPresent(obj, keys, label = "") {
	for (const key of keys) {
		expect(obj[key], `${label} — key "${key}" should be defined`).toBeDefined();
	}
}

/**
 * Assert that all specified keys are absent (undefined) from an object.
 * @param {object} obj - Object to check.
 * @param {string[]} keys - Keys that must be absent.
 * @param {string} [label] - Label for error messages.
 */
function expectKeysAbsent(obj, keys, label = "") {
	for (const key of keys) {
		expect(obj[key], `${label} — key "${key}" should be undefined`).toBeUndefined();
	}
}

// ─── Test matrix ─────────────────────────────────────────────────────────────

const MATRIX = [
	{ label: "diagnostics:false, hook:disabled", diagnostics: false, hook: { enabled: false } },
	{ label: "diagnostics:false, hook:enabled", diagnostics: false, hook: { enabled: true } },
	{ label: "diagnostics:true, hook:disabled", diagnostics: true, hook: { enabled: false } },
	{ label: "diagnostics:true, hook:enabled", diagnostics: true, hook: { enabled: true } }
];

// ─── Suites ───────────────────────────────────────────────────────────────────

describe("api.slothlet — diagnostics endpoint availability", () => {
	describe.each(MATRIX)("$label", ({ diagnostics, hook }) => {
		let api;

		beforeEach(async () => {
			api = await slothlet({
				mode: "eager",
				runtime: "async",
				diagnostics,
				hook,
				dir: BASE_DIR,
				api: {
					collision: { initial: "replace", api: "replace" }
				}
			});
		});

		afterEach(async () => {
			if (api) {
				await api.shutdown();
				api = null;
			}
		});

		// ─── Always-present endpoints ─────────────────────────────────────

		describe("always-present top-level keys", () => {
			it("should have all 15 always-present keys defined on api.slothlet", () => {
				expectKeysPresent(api.slothlet, ALWAYS_PRESENT_KEYS, "api.slothlet");
			});

			it("api.slothlet.version should be a non-empty string", () => {
				expect(typeof api.slothlet.version).toBe("string");
				expect(api.slothlet.version.length).toBeGreaterThan(0);
			});

			it("api.slothlet.instanceID should be a non-empty string", () => {
				expect(typeof api.slothlet.instanceID).toBe("string");
				expect(api.slothlet.instanceID.length).toBeGreaterThan(0);
			});

			it("api.slothlet.types should have UNMATERIALIZED and IN_FLIGHT symbols", () => {
				expect(typeof api.slothlet.types.UNMATERIALIZED).toBe("symbol");
				expect(typeof api.slothlet.types.IN_FLIGHT).toBe("symbol");
			});

			it("api.slothlet.api should have add, remove, reload functions", () => {
				expectKeysPresent(api.slothlet.api, EXPECTED_API_SUBKEYS, "api.slothlet.api");
				for (const key of EXPECTED_API_SUBKEYS) {
					expect(typeof api.slothlet.api[key], `api.slothlet.api.${key} should be a function`).toBe("function");
				}
			});

			it("api.slothlet.sanitize should be a function", () => {
				expect(typeof api.slothlet.sanitize).toBe("function");
			});

			it("api.slothlet.context should have get, diagnostics, run, scope", () => {
				expectKeysPresent(api.slothlet.context, EXPECTED_CONTEXT_SUBKEYS, "api.slothlet.context");
			});

			it("api.slothlet.hook should have on, remove, clear, off, enable, disable, list", () => {
				expectKeysPresent(api.slothlet.hook, EXPECTED_HOOK_SUBKEYS, "api.slothlet.hook");
				for (const key of EXPECTED_HOOK_SUBKEYS) {
					expect(typeof api.slothlet.hook[key], `api.slothlet.hook.${key} should be a function`).toBe("function");
				}
			});

			it("api.slothlet.metadata should have setGlobal, set, remove, setFor, removeFor", () => {
				expectKeysPresent(api.slothlet.metadata, EXPECTED_METADATA_SUBKEYS, "api.slothlet.metadata");
				for (const key of EXPECTED_METADATA_SUBKEYS) {
					expect(typeof api.slothlet.metadata[key], `api.slothlet.metadata.${key} should be a function`).toBe("function");
				}
			});

			it("api.slothlet.scope should be a function", () => {
				expect(typeof api.slothlet.scope).toBe("function");
			});

			it("api.slothlet.run should be a function", () => {
				expect(typeof api.slothlet.run).toBe("function");
			});

			it("api.slothlet.reload should be a function", () => {
				expect(typeof api.slothlet.reload).toBe("function");
			});

			it("api.slothlet.shutdown should be a function", () => {
				expect(typeof api.slothlet.shutdown).toBe("function");
			});

			it("api.slothlet.owner should have get", () => {
				expectKeysPresent(api.slothlet.owner, EXPECTED_OWNER_SUBKEYS, "api.slothlet.owner");
				expect(typeof api.slothlet.owner.get).toBe("function");
			});

			it("api.slothlet.materialize should have materialized, get, wait", () => {
				expectKeysPresent(api.slothlet.materialize, EXPECTED_MATERIALIZE_SUBKEYS, "api.slothlet.materialize");
			});

			it("api.slothlet.lifecycle should have on, off, subscribe, unsubscribe, emit", () => {
				expectKeysPresent(api.slothlet.lifecycle, EXPECTED_LIFECYCLE_SUBKEYS, "api.slothlet.lifecycle");
			});
		});

		// ─── Never-present endpoints ──────────────────────────────────────

		describe("never-present keys", () => {
			it("api.slothlet.hooks (plural) should never be defined — it is a dead code path in api_builder.mjs", () => {
				expectKeysAbsent(api.slothlet, NEVER_PRESENT_KEYS, "api.slothlet");
			});
		});

		// ─── Diagnostics-conditional endpoints ───────────────────────────

		if (diagnostics === false) {
			describe("diagnostics:false — diag namespace must be absent", () => {
				it("api.slothlet.diag should be undefined", () => {
					expectKeysAbsent(api.slothlet, DIAG_ONLY_KEYS, "api.slothlet");
				});

				it("api.slothlet should have exactly the 15 always-present keys and no more", () => {
					const actualKeys = Object.keys(api.slothlet);
					for (const key of ALWAYS_PRESENT_KEYS) {
						expect(actualKeys, `key "${key}" should be in Object.keys`).toContain(key);
					}
					for (const key of DIAG_ONLY_KEYS) {
						expect(actualKeys, `key "${key}" must NOT be in Object.keys when diagnostics is off`).not.toContain(key);
					}
					for (const key of NEVER_PRESENT_KEYS) {
						expect(actualKeys, `key "${key}" must NOT be in Object.keys ever`).not.toContain(key);
					}
				});
			});
		}

		if (diagnostics === true) {
			describe("diagnostics:true — diag namespace must be fully present", () => {
				it("api.slothlet.diag should be defined", () => {
					expect(api.slothlet.diag).toBeDefined();
				});

				it("api.slothlet.diag should have describe, reference, context, inspect, owner, caches, SlothletWarning", () => {
					expectKeysPresent(api.slothlet.diag, EXPECTED_DIAG_SUBKEYS, "api.slothlet.diag");
				});

				it("api.slothlet.diag.describe should be a function", () => {
					expect(typeof api.slothlet.diag.describe).toBe("function");
				});

				it("api.slothlet.diag.inspect should be a function", () => {
					expect(typeof api.slothlet.diag.inspect).toBe("function");
				});

				it("api.slothlet.diag.owner should have get function", () => {
					expectKeysPresent(api.slothlet.diag.owner, EXPECTED_DIAG_OWNER_SUBKEYS, "api.slothlet.diag.owner");
					expect(typeof api.slothlet.diag.owner.get).toBe("function");
				});

				it("api.slothlet.diag.caches should have get, getAllModuleIDs, has", () => {
					expectKeysPresent(api.slothlet.diag.caches, EXPECTED_DIAG_CACHES_SUBKEYS, "api.slothlet.diag.caches");
					for (const key of EXPECTED_DIAG_CACHES_SUBKEYS) {
						expect(typeof api.slothlet.diag.caches[key], `api.slothlet.diag.caches.${key} should be a function`).toBe("function");
					}
				});

				it("api.slothlet.diag.SlothletWarning should be a class/function", () => {
					expect(typeof api.slothlet.diag.SlothletWarning).toBe("function");
				});

				it("api.slothlet.diag.hook should always be defined (hookManager is always instantiated) and reflect hook.enabled state", () => {
					// The hookManager is always created regardless of hook.enabled — it's just
					// disabled (intercepting nothing) when hook.enabled: false. Therefore
					// api.slothlet.diag.hook is always present when diagnostics is on, and its
					// `enabled` property mirrors the hook.enabled config value.
					expect(api.slothlet.diag.hook).toBeDefined();
					expect(api.slothlet.diag.hook.enabled).toBe(hook.enabled);
				});

				it("api.slothlet should have exactly the 15 always-present keys plus diag", () => {
					const actualKeys = Object.keys(api.slothlet);
					for (const key of ALWAYS_PRESENT_KEYS) {
						expect(actualKeys, `key "${key}" should be in Object.keys`).toContain(key);
					}
					for (const key of DIAG_ONLY_KEYS) {
						expect(actualKeys, `key "${key}" should be in Object.keys when diagnostics is on`).toContain(key);
					}
					for (const key of NEVER_PRESENT_KEYS) {
						expect(actualKeys, `key "${key}" must NOT be in Object.keys ever`).not.toContain(key);
					}
				});
			});
		}
	});
});
