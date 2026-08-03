/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modes/underscore-export-parity.test.vitest.mjs
 *	@Date: 2026-08-03 12:00:00 -07:00 (1785783600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-03 12:00:00 -07:00 (1785783600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview An export named `_x` / `__x` is an api member in both modes.
 *
 * @description
 * The documented hidden-entry rule (docs/MODULE-STRUCTURE.md) excludes `.`/`__`-prefixed FILE and
 * FOLDER names from the scan; it says nothing about export names, and a module writing
 * `export const __priv` has deliberately placed that member on its surface. The proxy traps
 * nonetheless treated any underscore-prefixed property as framework-internal, so under lazy such a
 * member was invisible to `Object.keys()` and read back `undefined` — while eager served it. The
 * framework's genuinely reserved names are an explicit set (`INTERNAL_KEYS` + `IMPL_METADATA_KEYS`),
 * which is what the traps gate on now.
 *
 * Whether the prefix should additionally mean *module-private* is a separate feature (#260); these
 * assertions pin only that the member composes identically in both modes and never silently
 * disappears.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;
const EXPECTED = ["__priv", "_semi", "plain"];

describe("Modes > underscore-prefixed exports compose in both modes", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("eager exposes underscore exports to the host", async () => {
		api = await slothlet({ mode: "eager", base: BASE });

		expect(Object.keys(api.mod).sort()).toEqual(EXPECTED);
		expect(api.mod.__priv).toBe("p");
		expect(api.mod._semi).toBe("s");
	});

	it("lazy exposes underscore exports to the host", async () => {
		api = await slothlet({ mode: "lazy", base: BASE });

		// Settle the slot the way ordinary access does before enumerating.
		await api.mod.plain;
		const mod = await api.mod;
		expect(Object.keys(mod).sort()).toEqual(EXPECTED);
		expect(await mod.__priv).toBe("p");
		expect(await mod._semi).toBe("s");
	});

	it("exposes them to the in-module view through self, in both modes", async () => {
		for (const mode of ["eager", "lazy"]) {
			const instance = await slothlet({ mode, base: BASE });
			try {
				// A member reachable from the host but not from `self` (or the reverse) is exactly the
				// asymmetry this covers — the read gate and the enumeration path are different traps.
				const seen = await instance.consumer.readViaSelf();
				expect(seen.keys, `${mode} self view`).toEqual(EXPECTED);
				expect(seen.priv).toBe("p");
				expect(seen.semi).toBe("s");
			} finally {
				await instance.shutdown();
			}
		}
	});

	it("resolves them through a pure chained read in both modes", async () => {
		for (const mode of ["eager", "lazy"]) {
			const instance = await slothlet({ mode, base: BASE });
			try {
				// No intermediate await: under lazy this builds a waiting proxy and resolves through the
				// chain walk, a different path from reading off an already-awaited namespace.
				expect(await instance.mod.__priv, `${mode} chained __priv`).toBe("p");
				expect(await instance.mod._semi, `${mode} chained _semi`).toBe("s");
			} finally {
				await instance.shutdown();
			}
		}
	});

	it("agrees across enumeration, description, and `in` for a user export", async () => {
		for (const mode of ["eager", "lazy"]) {
			const instance = await slothlet({ mode, base: BASE });
			try {
				await instance.mod.plain;
				const mod = await instance.mod;
				// A member the surface enumerates must also be describable and answer `in` — a trap that
				// disagrees with its siblings is the inconsistency read gating exists to prevent.
				for (const key of ["__priv", "_semi"]) {
					expect(Object.keys(mod), `${mode} keys`).toContain(key);
					expect(key in mod, `${mode} in(${key})`).toBe(true);
					expect(Object.getOwnPropertyDescriptor(mod, key), `${mode} descriptor(${key})`).toBeDefined();
				}
			} finally {
				await instance.shutdown();
			}
		}
	});

	it("keeps framework names off every trap, not just enumeration", async () => {
		for (const mode of ["eager", "lazy"]) {
			const instance = await slothlet({ mode, base: BASE });
			try {
				await instance.mod.plain;
				const mod = await instance.mod;
				// Nothing framework-reserved is an api member, so none of these may be enumerated.
				for (const reserved of ["__childFilePaths", "__impl", "_materialize"]) {
					expect(Object.keys(mod), `${mode} keys`).not.toContain(reserved);
				}
				// Metadata and private state must also be invisible to `in` — withholding
				// `__childFilePaths` from ownKeys while `in` still answered true was the asymmetry here.
				for (const hidden of ["__childFilePaths", "__impl"]) {
					expect(hidden in mod, `${mode} in(${hidden})`).toBe(false);
				}
			} finally {
				await instance.shutdown();
			}
		}
	});

	it("does not serve impl bookkeeping to a direct read or a descriptor", async () => {
		// Hiding a name from `ownKeys` is not the same as withholding it. `__childFilePaths` is a lazy
		// impl's map of child name -> ABSOLUTE host path; it is not in `INTERNAL_KEYS`, so getTrap's
		// reserved-name filter used to miss it, the read fell through to the impl handing those paths to
		// any caller, and a descriptor came back for a key `ownKeys` and `in` both denied. Eager, having
		// no such impl, returned undefined — so this pins mode parity as well as the leak.
		for (const mode of ["eager", "lazy"]) {
			const instance = await slothlet({ mode, base: BASE });
			try {
				await instance.mod.plain;
				const mod = await instance.mod;
				for (const meta of ["__childFilePaths", "__childFilePathsPreMaterialize"]) {
					expect(mod[meta], `${mode} read(${meta})`).toBeUndefined();
					expect(Object.getOwnPropertyDescriptor(mod, meta), `${mode} descriptor(${meta})`).toBeUndefined();
				}
			} finally {
				await instance.shutdown();
			}
		}
	});

	it("still serves the reserved names that are part of the public wrapper surface", async () => {
		// The counterweight to the filter above: widening it must not withhold the reserved names the
		// wrapper deliberately publishes, several of which other suites read off a live api.
		for (const mode of ["eager", "lazy"]) {
			const instance = await slothlet({ mode, base: BASE });
			try {
				await instance.mod.plain;
				const mod = await instance.mod;
				expect(typeof mod.__filePath, `${mode} __filePath`).toBe("string");
				expect(typeof mod.__sourceFolder, `${mode} __sourceFolder`).toBe("string");
				expect(typeof mod.__moduleID, `${mode} __moduleID`).toBe("string");
				expect(mod.__apiPath, `${mode} __apiPath`).toBe("mod");
				expect(mod.__mode, `${mode} __mode`).toBe(mode);
				expect(typeof mod._materialize, `${mode} _materialize`).toBe("function");
				// Private state stays private regardless of how the filter is widened.
				expect(mod.____slothletInternal, `${mode} ____slothletInternal`).toBeUndefined();
				expect(mod.__impl, `${mode} __impl`).toBeUndefined();
			} finally {
				await instance.shutdown();
			}
		}
	});

	it("does not let a module displace framework-reserved names", async () => {
		for (const mode of ["eager", "lazy"]) {
			const instance = await slothlet({ mode, base: BASE });
			try {
				// `clash.mjs` exports `_materialize` and `__impl`. Freeing ordinary underscore exports must
				// not free these: `_materialize` is how lazy mode drives materialization, so a module that
				// could replace it would break loading outright.
				const clash = mode === "lazy" ? await instance.clash : instance.clash;
				expect(typeof clash._materialize, `${mode} _materialize stays the framework's`).toBe("function");
				expect(await clash.safe, `${mode} ordinary member unaffected`).toBe("safe");
				// And the module still materializes — the reserved name is doing its real job. A rejection
				// fails the await; the surface staying readable afterwards is the meaningful outcome.
				await clash._materialize();
				expect(await clash.safe, `${mode} member readable after explicit materialize`).toBe("safe");
			} finally {
				await instance.shutdown();
			}
		}
	});

	it("does not expose private prototype methods through a lazy chain walk", async () => {
		// Narrowing the reserved set must not open the wrapper's PROTOTYPE: `in` walks it, and the
		// broad prefix test used to be the only thing standing between a chain walk and the
		// framework's private methods. Freeing `__priv` must not free `_applyNewImpl` — a chained
		// call on an unmaterialized node has to reject as not-callable, not execute internals.
		api = await slothlet({ mode: "lazy", base: BASE });

		for (const priv of ["____inspectCustom", "_applyNewImpl", "___adoptImplChildren", "___createWaitingProxy"]) {
			// Refusal has two legitimate shapes — the read yields undefined (so invoking throws
			// synchronously) or a chained call rejects as not-callable. What it must never do is
			// resolve: that means the walk found the method on the prototype and executed it.
			const outcome = await Promise.resolve()
				.then(() => api.mod[priv]())
				.then(
					(value) => ({ resolved: true, value }),
					(error) => ({ resolved: false, message: error.message })
				);
			expect(outcome.resolved, `call(${priv}) must refuse, got ${JSON.stringify(outcome)}`).toBe(false);
			expect(outcome.message).toMatch(/CHAIN_NOT_CALLABLE|not callable|is not a function/i);
		}
		// And the module still works afterwards — the walk was refused, not broken.
		expect(await api.mod.plain).toBe("ok");
	});

	it("keeps framework-named module exports out of serialization", async () => {
		// `_extractFullImpl` feeds toJSON. Its filter must be the same exact reserved set every other
		// trap uses: `clash` exports `_materialize` / `__impl` as "HIJACKED", which `ownKeys` and `get`
		// both withhold — serialization disclosing them would be a trap-by-trap disagreement.
		for (const mode of ["eager", "lazy"]) {
			const instance = await slothlet({ mode, base: BASE });
			try {
				const clash = mode === "lazy" ? await instance.clash : instance.clash;
				const json = JSON.stringify(clash);
				expect(json, `${mode} serialized`).toContain("safe");
				expect(json, `${mode} must not disclose reserved-name exports`).not.toContain("HIJACKED");
			} finally {
				await instance.shutdown();
			}
		}
	});

	it("still hides framework metadata from the composed surface", async () => {
		// The counterpart the fix must not undo: reserved names stay off the api. `__childFilePaths`
		// rides on a lazy impl and is bookkeeping, never a member.
		api = await slothlet({ mode: "lazy", base: BASE });

		await api.mod.plain;
		const keys = Object.keys(await api.mod);
		expect(keys).not.toContain("__childFilePaths");
		expect(keys).not.toContain("____slothletInternal");
		expect(keys).not.toContain("_materialize");
	});
});
