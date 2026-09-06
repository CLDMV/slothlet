/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/wrap-on-set-context.test.vitest.mjs
 *	@Date: 2026-09-04 12:00:00 -07:00 (1788469200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-04 12:00:00 -07:00 (1788469200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Writable `self.X = <object>` (wrap-on-set) gives the assigned object's methods
 * the same working `self`/context that `api.slothlet.api.add()` does (#329).
 *
 * @description
 * `docs/CONTEXT-PROPAGATION.md` states that assigning a function or object to an owned `self.X`
 * path applies "the same wrapper construction `api.slothlet.api.add()` uses." Previously the set
 * trap stored the assigned value RAW (a bare `defineProperty`), so an assigned object's methods
 * ran outside any context-preserving wrapper and a later `self.*` access threw
 * `RUNTIME_NO_ACTIVE_CONTEXT_SELF` — while the identical object mounted via `add()` worked. This
 * suite pins that both mounting mechanisms give the object's methods working cross-module `self`.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

/** Sibling module reached via `self.other.pong()` from an assigned/added object's method. */
const OTHER = {
	exports: {
		/** @returns {string} A fixed marker so the caller can assert cross-module reach. */
		pong() {
			return "pong";
		}
	}
};

/** A module that grows its own namespace at runtime two ways: wrap-on-set and add(). */
const REGISTRY = {
	exports: {
		/**
		 * Grows the namespace via writable `self.X = <object>` (the #329 path).
		 * @param {string} key - Sub-key to create under `registry`.
		 * @returns {Promise<void>}
		 */
		async viaAssignment(key) {
			self.registry[key] = { ping: async () => self.other.pong() };
		},
		/**
		 * Grows the namespace via `add()` (the already-working control path). Uses the SAME plain
		 * inline-object shape as `viaAssignment` (not a `{ exports }` wrapper) so the two paths are a
		 * true apples-to-apples comparison of the repro (#333 review).
		 * @param {string} key - Sub-key to create under `registry`.
		 * @returns {Promise<void>}
		 */
		async viaAdd(key) {
			await self.slothlet.api.add(`registry.${key}`, { ping: async () => self.other.pong() });
		},
		/**
		 * Grows the namespace via a DEEPLY-NESTED writable `self.X = <object>` assignment, so a method
		 * several levels below the assigned root must still resolve cross-module `self` (#329).
		 * @param {string} key - Sub-key to create under `registry`.
		 * @returns {Promise<void>}
		 */
		async viaDeepAssignment(key) {
			self.registry[key] = { level1: { level2: { ping: async () => self.other.pong() } } };
		}
	}
};

describe.each(getMatrixConfigs({ runtime: "async" }))("Context > writable self.X wrap-on-set (#329) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("an object assigned via self.X = {…} gets methods with working self, like add() does", async () => {
		api = await slothlet({ ...config, base: BASE, api: { mutations: { add: true, remove: true, reload: true } } });
		await api.slothlet.api.add("other", OTHER);
		await api.slothlet.api.add("registry", REGISTRY);

		// Control: the add() path has always given the object's methods working self.
		await api.registry.viaAdd("b");
		expect(await api.registry.b.ping()).toBe("pong");

		// #329: the wrap-on-set path must now behave identically (previously threw
		// RUNTIME_NO_ACTIVE_CONTEXT_SELF because the assigned object was stored unwrapped).
		await api.registry.viaAssignment("a");
		expect(await api.registry.a.ping()).toBe("pong");
	});

	it("a DEEPLY-NESTED object assigned via self.X = {…} keeps working self at depth (#329)", async () => {
		api = await slothlet({ ...config, base: BASE, api: { mutations: { add: true, remove: true, reload: true } } });
		await api.slothlet.api.add("other", OTHER);
		await api.slothlet.api.add("registry", REGISTRY);

		// The assigned subtree is wrapped one level per access (deferChildAdopt, #329/#247), so a method
		// several levels below the assigned root must still resolve cross-module self — not just a
		// method sitting directly on the assigned object.
		await api.registry.viaDeepAssignment("d");
		expect(await api.registry.d.level1.level2.ping()).toBe("pong");
	});

	it("a wrap-on-set userAssigned child survives a reload of its module (#329)", async () => {
		api = await slothlet({ ...config, base: BASE, api: { mutations: { add: true, remove: true, reload: true } } });
		await api.slothlet.api.add("other", OTHER);
		const moduleID = await api.slothlet.api.add("registry", REGISTRY);

		// Grow the namespace with a wrap-on-set override, then reload the module. Reload re-adopts the
		// module's fresh content into the existing wrapper via syncWrapper, which must recognise the
		// `userAssigned` child and leave it untouched rather than delete or merge over it (#329).
		await api.registry.viaAssignment("keep");
		expect(await api.registry.keep.ping()).toBe("pong");

		await api.slothlet.api.reload(moduleID);

		// The override survived the reload verbatim, with working cross-module self intact.
		expect(await api.registry.keep.ping()).toBe("pong");
	});

	it("a wrap-on-set userAssigned child is preserved when its module is re-added (collision merge → syncWrapper) (#329)", async () => {
		api = await slothlet({ ...config, base: BASE, api: { mutations: { add: true, remove: true, reload: true } } });
		await api.slothlet.api.add("other", OTHER);
		await api.slothlet.api.add("registry", REGISTRY);

		await api.registry.viaAssignment("keep");
		expect(await api.registry.keep.ping()).toBe("pong");

		// Re-add the same mount with collision "merge": existing and next are both wrapper proxies, so
		// the merge routes through syncWrapper, whose userAssigned loop must recognise the wrap-on-set
		// `keep` override and leave it untouched while merging the new content in (#329).
		await api.slothlet.api.add("registry", { exports: { extra: () => "extra" } }, { collisionMode: "merge" });

		expect(await api.registry.keep.ping()).toBe("pong"); // override preserved through the resync
		expect(await api.registry.extra()).toBe("extra"); // new content merged alongside it
	});
});

/** Plants the SAME pure-data object two ways — wrap-on-set assignment and add() — for a parity check. */
const VAULT = {
	exports: {
		/** Plant a pure-data object via writable `self.X = <object>` (the #329 wrap-on-set path). */
		async plantAssigned() {
			self.vault.assigned = { apiKey: "abc123", publicName: "ok" };
		},
		/** Plant the identical pure-data object via `add()` (the control path). */
		async plantAdded() {
			await self.slothlet.api.add("vault.added", { apiKey: "abc123", publicName: "ok" });
		}
	}
};

/** A denied caller (`reader.**`) that reads the gated terminals from within its own context. */
const READER = {
	exports: {
		/** @returns {Promise<string>} Direct read of the wrap-on-set terminal (must be gated). */
		async readAssignedKey() {
			return self.vault.assigned.apiKey;
		},
		/** @returns {Promise<string>} Direct read of the add()-mounted terminal (must be gated). */
		async readAddedKey() {
			return self.vault.added.apiKey;
		},
		/** @returns {Promise<string>} Serialization of the wrap-on-set object (must not leak values). */
		async stringifyAssigned() {
			return JSON.stringify(self.vault.assigned);
		}
	}
};

/**
 * @fileoverview A pure-data object assigned via wrap-on-set must be permission read-gated exactly like
 * the same object mounted via `add()` (#329).
 *
 * @description
 * The whole point of wrapping an assigned object (rather than storing it raw) is that its terminals
 * flow through the read gate on access. A data object with no methods gains nothing from context
 * wrapping — but it still must be permission-checkable, and it can't be unless it's wrapped. This
 * suite pins that a denied caller is blocked reading a wrap-on-set-assigned terminal, identically to
 * an `add()`-mounted one, and that serialization doesn't leak the value either (#242 read gating).
 */
describe.each(getMatrixConfigs())("Context > wrap-on-set data read-gating parity (#329) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a pure-data object assigned via self.X = {…} is read-gated exactly like the same object mounted via add()", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			api: { mutations: { add: true, remove: true, reload: true } },
			permissions: { defaultPolicy: "allow", rules: [{ caller: "reader.**", target: "vault.**", effect: "deny" }] }
		});
		await api.slothlet.api.add("vault", VAULT);
		await api.slothlet.api.add("reader", READER);
		await api.vault.plantAssigned();
		await api.vault.plantAdded();

		// The values exist and are readable by the host (uncontexted callers are exempt, like a direct read).
		expect(await api.vault.assigned.apiKey).toBe("abc123");
		expect(await api.vault.added.apiKey).toBe("abc123");

		// The denied caller is blocked on BOTH — wrap-on-set data gates identically to add()-mounted data.
		// (If the assigned object were stored RAW instead of wrapped, its terminal would never reach the
		// read gate and the denied caller would read "abc123".)
		await expect(async () => await api.reader.readAssignedKey()).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(async () => await api.reader.readAddedKey()).rejects.toThrow(/PERMISSION_DENIED/);

		// Serialization of the wrap-on-set object doesn't leak the denied terminal either (#242). Warm
		// once first: a cold lazy wrapper can enumerate empty before it materializes, which would pass a
		// bare "doesn't contain the value" check trivially — so warm, then assert the parsed result is
		// fully redacted to {} (verifies key-shape redaction, not just value absence).
		await api.reader.stringifyAssigned();
		const json = await api.reader.stringifyAssigned();
		expect(json).not.toContain("abc123");
		expect(JSON.parse(json)).toEqual({});
	});
});
