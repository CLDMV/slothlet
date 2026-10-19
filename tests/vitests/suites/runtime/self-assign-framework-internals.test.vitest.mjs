/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-framework-internals.test.vitest.mjs
 *	@Date: 2026-10-18T15:56:19-07:00 (1792364179)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-19T12:23:51-07:00 (1792437831)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module cannot change the framework's internal keys on an api node (#625).
 *
 * Every api node carries keys that are the framework's, not the module's: the wrapper's own state
 * (`____slothletInternal`, `_materialize`, `___setImpl`, …), what the node reports about itself (`__metadata`,
 * `__type`, `__apiPath`, …), and impl metadata (`__childFilePaths`, …). The built-in write rules of the
 * permission system refuse a module defining, assigning, or deleting any of them, on another module's node and on
 * its own, with `PERMISSION_DENIED`. A write the host makes is absorbed (it reports success and changes nothing, so
 * the key's existence does not leak).
 * Either way the framework's state is unchanged: with the defaults and with `defaultPolicy: "deny"`, in all four
 * mode / runtime configurations. With the permission system off (no `permissions` config) the built-in rules are
 * off too, and the ownership rule alone keeps a module off another module's node.
 *
 * Fixture: `api_tests/api_test_framework_namespace_guard` — `victim/` and `intruder/` both run `shared/internals.mjs`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

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
		options: { permissions: { defaultPolicy: "deny", rules: [{ caller: "**", target: "**", effect: "allow" }] } }
	}
];

const INTERNAL_KEYS = [
	"____slothletInternal",
	"____slothlet",
	"___setImpl",
	"___getState",
	"___resetLazy",
	"___invalidate",
	"__state",
	"__invalid",
	"__mode",
	"__apiPath",
	"__slothletPath",
	"__isCallable",
	"__materializeOnCreate",
	"__displayName",
	"__type",
	"__metadata",
	"__filePath",
	"__sourceFolder",
	"__moduleID",
	"__materialized",
	"__inFlight",
	"__impl",
	"_impl",
	"_materialize",
	"__childFilePaths",
	"__childFilePathsPreMaterialize"
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
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
			await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
			await api.slothlet.api.add("intruder", path.join(FIXTURE, "intruder"), { moduleID: "intruder" });
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

		it("refuses them by ownership, and leaves the framework's state unchanged", async () => {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true });
			await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
			await api.slothlet.api.add("intruder", path.join(FIXTURE, "intruder"), { moduleID: "intruder" });
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
							outcome: "LOOSE_SET_NOT_OWNED"
						});
					}
				}
				expect({ apiPath, after: snapshot(nodeAt(apiPath)) }).toEqual({ apiPath, after: before });
			}
			expect(await api.victim.v.hello()).toBe("victim");
			expect(api.victim.v.data.a).toBe(1);
		});
	}
);
