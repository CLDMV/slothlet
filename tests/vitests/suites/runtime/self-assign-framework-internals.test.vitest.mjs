/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/runtime/self-assign-framework-internals.test.vitest.mjs
 *	@Date: 2026-10-18T15:56:19-07:00 (1792364179)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:59-08:00 (1795869179)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module cannot change the framework's internal keys on an api node (#625).
 *
 * Every api node carries keys that are the framework's, not the module's: the wrapper's own state
 * (`____slothletInternal`, `___materialize`, `___setImpl`, …), what the node reports about itself (`__metadata`,
 * `__type`, `__apiPath`, …), and impl metadata (`____childFilePaths`, …). The built-in write rules of the
 * permission system refuse a module defining, assigning, or deleting any of them, on another module's node and on
 * its own, with `PERMISSION_DENIED`. A write the host makes is absorbed (it reports success and changes nothing, so
 * the key's existence does not leak).
 * Either way the framework's state is unchanged: with the defaults and with `defaultPolicy: "deny"`, in all four
 * mode / runtime configurations. With the permission system off (no `permissions` config) nothing decides writes:
 * the built-in rules and the ownership rule are off, and a module changes these keys as it changes any member.
 *
 * Fixture: `api_tests/api_test_framework_namespace_guard` — `api_test_framework_namespace_guard_victim/` and `_intruder/` both run `lib/internals.mjs`.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync, apiPart } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_FRAMEWORK_NAMESPACE_GUARD;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const PERMISSIONS = [
	{ label: "permissions with defaults", options: { permissions: {} } },
	{
		label: "permissions defaultPolicy deny",
		options: { permissions: { policy: "deny", rules: [{ caller: "**", target: "**", effect: "allow" }] } }
	}
];

const INTERNAL_KEYS = [
	"____slothletInternal",
	"____slothlet",
	"___setImpl",
	"___getState",
	"___resetLazy",
	"___invalidate",
	"____state",
	"____invalid",
	"____materializeOnCreate",
	"____displayName",
	"____filePath",
	"____impl",
	"___materialize",
	"____childFilePaths",
	"____childFilePathsPreMaterialize"
];

/**
 * What the framework holds for every internal key of a node: the wrapper's own descriptor, the proxy
 * target's, and the impl's.
 * @param {object} node - The node, as the host reads it.
 * @returns {Record<string, string>} A comparable snapshot.
 */
function snapshot(node) {
	const wrapper = resolveWrapper(node);
	const impl = wrapper.____slothletInternal.impl;
	const describe = (holder, key) => {
		if (holder === null || (typeof holder !== "object" && typeof holder !== "function")) return "-";
		const descriptor = Object.getOwnPropertyDescriptor(holder, key);
		if (!descriptor) return "absent";
		const value = "value" in descriptor ? descriptor.value : descriptor.get;
		return `${typeof value}:${typeof value === "function" ? value.name : String(value)}:${descriptor.writable}:${descriptor.configurable}`;
	};
	return Object.fromEntries(INTERNAL_KEYS.map((key) => [key, `${describe(wrapper, key)} | ${describe(impl, key)}`]));
}

describe.each(CONFIGS)("module writes to a node's framework-internal keys (#625) — $mode / $runtime", ({ mode, runtime }) => {
	describe.each(PERMISSIONS)("$label", ({ options }) => {
		let api;

		afterEach(async () => {
			if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
			api = null;
		});

		/**
		 * Mount the victim and the intruder as two modules.
		 * @returns {Promise<object>} The composed api.
		 */
		async function load() {
			api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, ...options });
			await api.slothlet.api.add("victim", apiPart(FIXTURE, "victim"), { id: "victim" });
			await api.slothlet.api.add("intruder", apiPart(FIXTURE, "intruder"), { id: "intruder" });
			// A lazy node is read once so there is a materialized wrapper to compare against.
			await api.victim.v.hello();
			return api;
		}

		const NODES = ["victim", "victim.v", "victim.v.hello", "victim.v.data"];
		const nodeAt = (apiPath) => apiPath.split(".").reduce((value, key) => value[key], api);

		for (const [label, attacker] of [
			["another module's node", () => api.intruder.x],
			["the module's own node", () => api.victim.v]
		]) {
			it(`refuses changing the internal keys of ${label}`, async () => {
				await load();
				for (const apiPath of NODES) {
					const before = snapshot(nodeAt(apiPath));
					const report = withSuppressedSlothletErrorOutputSync(() => attacker().changeInternals(apiPath));
					for (const key of INTERNAL_KEYS) {
						expect({ apiPath, key, outcome: report[`define ${key}`] }).toEqual({ apiPath, key, outcome: "PERMISSION_DENIED" });
						expect({ apiPath, key, outcome: report[`set ${key}`] }).toEqual({ apiPath, key, outcome: "PERMISSION_DENIED" });
						expect({ apiPath, key, outcome: report[`delete ${key}`] }).toEqual({ apiPath, key, outcome: "PERMISSION_DENIED" });
					}
					expect({ apiPath, after: snapshot(nodeAt(apiPath)) }).toEqual({ apiPath, after: before });
				}
				expect(await api.victim.v.hello()).toBe("victim");
				expect(api.victim.v.data.a).toBe(1);
			});
		}

		it("refuses changing the internal keys of a node the module kept, later from outside any call", async () => {
			await load();
			for (const apiPath of NODES) {
				const later = await api.victim.v.keepNode(apiPath);
				const before = snapshot(nodeAt(apiPath));
				const report = withSuppressedSlothletErrorOutputSync(() => later());
				for (const key of INTERNAL_KEYS) {
					for (const change of ["define", "set", "delete"]) {
						expect({ apiPath, key, change, outcome: report[`${change} ${key}`] }).toEqual({
							apiPath,
							key,
							change,
							outcome: "PERMISSION_DENIED"
						});
					}
				}
				expect({ apiPath, after: snapshot(nodeAt(apiPath)) }).toEqual({ apiPath, after: before });
			}
		});
	});
});

describe.each(CONFIGS)(
	"module writes to another module's framework-internal keys, permission system off (#625) — $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
			api = null;
		});

		it.each([
			["keeps a module off them: the built-in write rules stay with the system off", {}, "PERMISSION_DENIED"],
			["lets a module change them with the system disabled", { permissions: { mode: "disabled" } }, "done"]
		])("%s", async (_label, options, outcome) => {
			api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, ...options });
			await api.slothlet.api.add("victim", apiPart(FIXTURE, "victim"), { id: "victim" });
			await api.slothlet.api.add("intruder", apiPart(FIXTURE, "intruder"), { id: "intruder" });
			await api.victim.v.hello();
			const nodeAt = (apiPath) => apiPath.split(".").reduce((value, key) => value[key], api);
			for (const apiPath of ["victim", "victim.v", "victim.v.hello", "victim.v.data"]) {
				const before = snapshot(nodeAt(apiPath));
				const report = withSuppressedSlothletErrorOutputSync(() => api.intruder.x.changeInternals(apiPath));
				for (const key of INTERNAL_KEYS) {
					for (const change of ["define", "set", "delete"]) {
						expect({ apiPath, key, change, outcome: report[`${change} ${key}`] }).toEqual({
							apiPath,
							key,
							change,
							outcome
						});
					}
				}
				if (outcome === "done") expect({ apiPath, after: snapshot(nodeAt(apiPath)) }).not.toEqual({ apiPath, after: before });
				else expect({ apiPath, after: snapshot(nodeAt(apiPath)) }).toEqual({ apiPath, after: before });
			}
			// The framework's own handle on the node is not one of the keys a module reaches.
			expect(await api.victim.v.hello()).toBe("victim");
			expect(api.victim.v.data.a).toBe(1);
		});
	}
);
