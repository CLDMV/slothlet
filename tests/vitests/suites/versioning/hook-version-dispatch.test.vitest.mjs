/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/hook-version-dispatch.test.vitest.mjs
 *	@Date: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Hook registration participates in api path versioning (#250).
 *
 * @description
 * Calls route through the `versionDispatcher` seam; hook registration did not — a hook written
 * against the logical path (`"auth.login"`, the shape used for calls) silently matched nothing
 * once the target mounted versioned, and the `"v*"` glob workaround hooked every installed major
 * regardless of the registrant's declared compatibility. Registration now takes the same seam:
 * `{ versioned: true }` resolves through the instance's configured dispatcher exactly as a call
 * would, `{ versionDispatcher }` overrides per registration (and may select SEVERAL versions),
 * a dispatcher returning nothing falls back to the same default-version resolution calls use,
 * and the handler receives the firing version as structured context (`version`) rather than
 * parsing it out of `path`. One registration id covers every selected version — a single
 * `remove({ id })` unhooks them all. Literal and glob patterns without the seam are unchanged.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/**
 * Boots an instance with two versioned mounts of the same logical path.
 * @param {object} [extra={}] - Extra top-level config (e.g. a versionDispatcher).
 * @returns {Promise<object>} The bound api with `auth` mounted at v1 (default) and v2.
 */
async function bootVersioned(extra = {}) {
	const api = await slothlet({ mode: "eager", base: BASE, hook: { enabled: true }, ...extra });
	await api.slothlet.api.add(
		"auth",
		{
			exports: {
				/**
				 * v1 login leaf.
				 * @returns {string} Identifier.
				 */
				login() {
					return "login-v1";
				}
			}
		},
		{},
		{ version: "v1", default: true }
	);
	await api.slothlet.api.add(
		"auth",
		{
			exports: {
				/**
				 * v2 login leaf.
				 * @returns {string} Identifier.
				 */
				login() {
					return "login-v2";
				}
			}
		},
		{},
		{ version: "v2" }
	);
	return api;
}

describe("Versioning > hook registration dispatch (#250)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("pins the gap: a literal logical pattern matches no versioned mount", async () => {
		api = await bootVersioned();
		const fires = [];
		api.slothlet.hook.on("auth.login:before", () => void fires.push("hit"), { id: "literal" });

		await api.v1.auth.login();
		await api.v2.auth.login();
		expect(fires, "the pre-existing behavior the seam exists to fix").toEqual([]);
	});

	it("resolves { versioned: true } through the instance dispatcher like a call", async () => {
		api = await bootVersioned({ versionDispatcher: () => "v2" });
		const fires = [];
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(version), {
			id: "seamed",
			versioned: true
		});

		await api.v1.auth.login();
		expect(fires, "v1 not selected").toEqual([]);
		await api.v2.auth.login();
		expect(fires, "fires on the dispatched version, version as structured context").toEqual(["v2"]);
	});

	it("falls back to the default version when the dispatcher returns nothing", async () => {
		api = await bootVersioned({ versionDispatcher: () => null });
		const fires = [];
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(version), {
			id: "defaulted",
			versioned: true
		});

		await api.v2.auth.login();
		expect(fires, "v2 not the default").toEqual([]);
		await api.v1.auth.login();
		expect(fires, "same default resolution calls use").toEqual(["v1"]);
	});

	it("honours a per-registration dispatcher selecting several versions", async () => {
		api = await bootVersioned();
		const fires = [];
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(version), {
			id: "ranged",
			versionDispatcher: (allVersions) => Object.keys(allVersions)
		});

		await api.v1.auth.login();
		await api.v2.auth.login();
		expect(fires.sort(), "one registration, every selected version, each self-identifying").toEqual(["v1", "v2"]);
	});

	it("removes every selected version through the one registration id", async () => {
		api = await bootVersioned();
		const fires = [];
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(version), {
			id: "composite",
			versionDispatcher: (allVersions) => Object.keys(allVersions)
		});

		const removed = api.slothlet.hook.remove({ id: "composite" });
		expect(removed, "both underlying registrations removed").toBe(2);

		await api.v1.auth.login();
		await api.v2.auth.login();
		expect(fires).toEqual([]);
	});

	it("throws a named error when no versions are registered for the pattern", async () => {
		api = await slothlet({ mode: "eager", base: BASE, hook: { enabled: true } });

		expect(() => api.slothlet.hook.on("nowhere.login:before", () => {}, { id: "lost", versioned: true })).toThrow(
			/HOOK_VERSION_UNRESOLVED/
		);
	});

	it("throws a named error naming an unregistered tag a dispatcher selects", async () => {
		api = await bootVersioned();

		expect(() =>
			api.slothlet.hook.on("auth.login:before", () => {}, {
				id: "bad-tag",
				versionDispatcher: () => "v9"
			})
		).toThrow(/HOOK_VERSION_UNKNOWN_TAG/);
	});

	it("falls back to the default when a per-registration dispatcher throws", async () => {
		api = await bootVersioned();
		const fires = [];
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(version), {
			id: "thrower",
			versionDispatcher: () => {
				throw new Error("dispatcher-boom");
			}
		});

		// A throwing dispatcher is treated as selecting nothing — the default-version fallback,
		// mirroring how call dispatch absorbs a discriminator failure.
		await api.v1.auth.login();
		expect(fires).toEqual(["v1"]);
	});

	it("removes only the group, leaving unrelated registrations alone", async () => {
		api = await bootVersioned();
		const fires = [];
		api.slothlet.hook.on("v1.auth.login:before", ({ version }) => void fires.push(`plain:${version}`), { id: "bystander" });
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(`group:${version}`), {
			id: "composite2",
			versionDispatcher: (allVersions) => Object.keys(allVersions)
		});

		expect(api.slothlet.hook.remove({ id: "composite2" }), "only the group's members").toBe(2);
		await api.v1.auth.login();
		expect(fires, "the bystander survives, with no version context of its own").toEqual(["plain:undefined"]);
	});

	it("collapses a dispatcher's duplicate tags into one registration", async () => {
		api = await bootVersioned();
		const fires = [];
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(version), {
			id: "dupes",
			versionDispatcher: () => ["v1", "v1", "v2"]
		});

		// Naming a tag twice means one registration for it — not a DUPLICATE_HOOK_ID failure on an
		// `id::tag` member the caller never chose.
		await api.v1.auth.login();
		expect(fires, "fires once for v1, not twice").toEqual(["v1"]);
		expect(api.slothlet.hook.remove({ id: "dupes" }), "one member per distinct tag").toBe(2);
	});

	it("refuses an inherited Object.prototype key as a version tag", async () => {
		api = await bootVersioned();

		// `versions` is a plain object, so a bare index lookup finds Object.prototype members and
		// would register a hook against a physical path that was never mounted.
		for (const tag of ["toString", "constructor", "valueOf"]) {
			expect(() => api.slothlet.hook.on("auth.login:before", () => {}, { id: `proto-${tag}`, versionDispatcher: () => tag })).toThrow(
				/HOOK_VERSION_UNKNOWN_TAG/
			);
		}
	});

	it("does not mutate an array the dispatcher returned", async () => {
		api = await bootVersioned();
		const selection = [];
		const fires = [];
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(version), {
			id: "borrowed",
			versionDispatcher: () => selection
		});

		// Selecting nothing falls back to the default tag; pushing that onto the caller's own array
		// would make registration silently rewrite a value the caller still holds.
		expect(selection, "the caller's array is untouched").toEqual([]);
		await api.v1.auth.login();
		expect(fires, "and the default-version fallback still happened").toEqual(["v1"]);
	});

	it("refuses to let a later plain hook reuse a live group id", async () => {
		api = await bootVersioned();
		api.slothlet.hook.on("auth.login:before", () => {}, {
			id: "claimed",
			versionDispatcher: (allVersions) => Object.keys(allVersions)
		});

		// The group id names a registration but is not itself a hook, so it is absent from the id
		// index. Reusing it would shadow the group on remove()'s fast path and strand its members.
		expect(() => api.slothlet.hook.on("v1.auth.login:before", () => {}, { id: "claimed" })).toThrow(/DUPLICATE_HOOK_ID/);
		expect(api.slothlet.hook.remove({ id: "claimed" }), "the group is still whole and still removable").toBe(2);
	});

	it("rolls back the whole group when one member fails to register", async () => {
		api = await bootVersioned();
		const fires = [];
		// Squat the SECOND member's id so registration fails partway through the group.
		api.slothlet.hook.on("v2.auth.login:before", () => void fires.push("squatter"), { id: "partial::v2" });

		expect(() =>
			api.slothlet.hook.on("auth.login:before", () => void fires.push("group"), {
				id: "partial",
				versionDispatcher: (allVersions) => Object.keys(allVersions)
			})
		).toThrow(/DUPLICATE_HOOK_ID/);

		// All-or-nothing: the caller never received the group id on the throw path, so a surviving
		// v1 member would be live and unremovable.
		expect(api.slothlet.hook.remove({ id: "partial" }), "no member survived the failed registration").toBe(0);
		await api.v1.auth.login();
		expect(fires, "the rolled-back v1 member does not fire").toEqual([]);
		await api.v2.auth.login();
		expect(fires, "the unrelated squatter is untouched").toEqual(["squatter"]);
	});

	it("survives export/import replay with binding and group removal intact", async () => {
		const { resolveWrapper } = await import("#handlers/unified-wrapper");
		api = await bootVersioned();
		const fires = [];
		api.slothlet.hook.on("auth.login:before", ({ version }) => void fires.push(version), {
			id: "replayed",
			versionDispatcher: (allVersions) => Object.keys(allVersions)
		});

		const hookManager = resolveWrapper(api.mod).slothlet.handlers.hookManager;
		const registrations = hookManager.exportHooks();
		expect(hookManager.remove({ id: "replayed" })).toBe(2);
		hookManager.importHooks(registrations);

		await api.v2.auth.login();
		expect(fires, "replayed member still fires with its version context").toEqual(["v2"]);
		expect(hookManager.remove({ id: "replayed" }), "group removal survives replay").toBe(2);
	});

	it("resolves the longest covering logical path when mounts nest", async () => {
		api = await slothlet({ mode: "eager", base: BASE, hook: { enabled: true } });
		// Register the DEEPER logical path first so the shorter one is a later, non-winning match.
		await api.slothlet.api.add(
			"auth.admin",
			{
				exports: {
					/**
					 * Deep-mount leaf.
					 * @returns {string} Identifier.
					 */
					login() {
						return "admin-login";
					}
				}
			},
			{},
			{ version: "v1", default: true }
		);
		await api.slothlet.api.add(
			"auth",
			{
				exports: {
					/**
					 * Shallow-mount leaf.
					 * @returns {string} Identifier.
					 */
					login() {
						return "auth-login";
					}
				}
			},
			{},
			{ version: "v1", default: true }
		);

		api.slothlet.hook.on("auth.admin.login:before", () => {}, {
			id: "nested",
			versioned: true
		});

		// The deeper mount owns the pattern — the registration resolved against v1.auth.admin, not
		// v1.auth with a dangling ".admin.login". (Asserted on the stored pattern so the check does
		// not depend on how the two overlapping mounts collided physically.)
		const entry = api.slothlet.hook.list().registeredHooks.find((hook) => hook.id === "nested::v1");
		expect(entry, "member registration exists under the group id").toBeDefined();
		expect(entry.pattern).toBe("v1.auth.admin.login");
	});

	it("reports unresolved for an uncovered pattern even with other mounts registered", async () => {
		api = await bootVersioned();

		// The registry is non-empty here — the auth entry is examined and rejected as not covering
		// the pattern, which is the discrimination the empty-registry variant above cannot make.
		expect(() => api.slothlet.hook.on("nowhere.login:before", () => {}, { id: "lost2", versioned: true })).toThrow(
			/HOOK_VERSION_UNRESOLVED/
		);
	});

	it("leaves plain and glob registrations untouched by the seam", async () => {
		api = await bootVersioned();
		const fires = [];
		// The documented workaround keeps working exactly as before: a glob across every major.
		api.slothlet.hook.on("v*.auth.login:before", ({ version }) => void fires.push(version ?? "unversioned-ctx"), {
			id: "glob"
		});

		await api.v1.auth.login();
		await api.v2.auth.login();
		// It fires for both — and carries NO version context, because the registration did not
		// resolve through the seam; the path is the only signal, as it always was.
		expect(fires).toEqual(["unversioned-ctx", "unversioned-ctx"]);
	});
});
