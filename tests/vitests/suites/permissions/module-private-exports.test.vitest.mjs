/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/module-private-exports.test.vitest.mjs
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
 * @fileoverview Module-private `_`/`__` exports (#260).
 *
 * @description
 * An underscore-prefixed export is private to its MODULE — the directory of files that exports it.
 * With permissions enabled, the other files of that same directory reach it through `self` (they
 * never import each other directly); every other module is denied, the host is denied by default
 * (`permissions.private.host: "allow"` opens it), and the guarantee is ABSOLUTE — no user rule can
 * grant a foreign module access, because the api path is a lossy projection of the module tree and
 * rules cannot encode "same module". A denial behaves like every other denial: refused on direct
 * read, redacted from enumeration, audited — never a silent vanishing. Without a permissions
 * config the members stay fully public, exactly as before the feature.
 *
 * The reserved half of the prefix space is settled alongside (#260's scan policy): a module FILE
 * or EXPORT named for a framework-reserved key is refused at load with a named error rather than
 * silently coexisting.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = new URL("../../../../api_tests/api_test_private", import.meta.url).pathname;
const REJECT_FILE = new URL("../../../../api_tests/api_test_reserved_reject_file", import.meta.url).pathname;
const REJECT_EXPORT = new URL("../../../../api_tests/api_test_reserved_reject_export", import.meta.url).pathname;

describe.each(["eager", "lazy"])("Permissions > module-private exports (#260) > %s", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("allows the same module's files to reach privates through self", async () => {
		api = await slothlet({ mode, base: BASE, permissions: { defaultPolicy: "allow", rules: [] } });

		// quote.mjs and internals.mjs share billing/ — the entire point of the marker: sibling
		// files use each other through self without importing each other directly.
		expect(await api.billing.quote.total(100)).toBe(125); // 100 * (1 + 0.2) + 5
	});

	it("denies another module the private members, audited like any denial", async () => {
		api = await slothlet({ mode, base: BASE, permissions: { defaultPolicy: "allow", rules: [] } });
		const denials = [];
		api.slothlet.lifecycle.on("permission:denied", (payload) => denials.push(payload));

		const peek = await api.reporting.peek.rate();
		expect(peek.rate).toBeUndefined();
		expect(peek.error).toBe("PERMISSION_DENIED");
		expect(
			denials.some((d) => d.target === "billing.internals.__rate"),
			"the refusal is audited, not silent"
		).toBe(true);
	});

	it("denies the host by default and redacts privates from its enumeration", async () => {
		api = await slothlet({ mode, base: BASE, permissions: { defaultPolicy: "allow", rules: [] } });

		let read;
		try {
			read = await api.billing.internals.__rate;
		} catch (e) {
			read = `THREW:${e.code}`;
		}
		expect(read, "direct host read refused").toBe("THREW:PERMISSION_DENIED");
		const internals = mode === "lazy" ? await api.billing.internals : api.billing.internals;
		expect(Object.keys(internals).sort(), "privates redacted, public member remains").toEqual(["_scale", "currency"]);
		// A private FUNCTION is not a terminal data value, so its KEY stays listed (traversal is free);
		// what the host cannot do is CALL it — asserted below.
	});

	it("opens the host through permissions.private.host allow", async () => {
		api = await slothlet({
			mode,
			base: BASE,
			permissions: { defaultPolicy: "allow", rules: [], private: { host: "allow" } }
		});

		expect(await api.billing.internals.__rate).toBe(0.2);
		const internals = mode === "lazy" ? await api.billing.internals : api.billing.internals;
		expect(Object.keys(internals).sort()).toEqual(["__rate", "_fee", "_scale", "currency"]);
	});

	it("is absolute: an explicit allow rule for the private target grants nothing", async () => {
		api = await slothlet({
			mode,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					// The most specific grant a user can write — a literal target, universal caller.
					{ caller: "**", target: "billing.internals.__rate", effect: "allow" },
					{ caller: "reporting.**", target: "billing.**", effect: "allow" }
				]
			}
		});

		// Privacy resolves BEFORE rules: the module boundary is not negotiable by configuration,
		// only by the owning module renaming its export public.
		const peek = await api.reporting.peek.rate();
		expect(peek.error).toBe("PERMISSION_DENIED");
	});

	it("stays fully public when permissions are not configured", async () => {
		api = await slothlet({ mode, base: BASE });

		// No permissions block = the system is disabled = pre-#260 behavior exactly.
		expect(await api.billing.internals.__rate).toBe(0.2);
		const internals = mode === "lazy" ? await api.billing.internals : api.billing.internals;
		expect(Object.keys(internals).sort()).toEqual(["__rate", "_fee", "_scale", "currency"]);
	});

	it("enforces privacy on the CALL path: the host cannot invoke a private function", async () => {
		api = await slothlet({ mode, base: BASE, permissions: { defaultPolicy: "allow", rules: [] } });

		let out;
		try {
			out = await api.billing.internals._scale(100);
		} catch (e) {
			out = `THREW:${e.code}`;
		}
		expect(out, "host call refused by default").toBe("THREW:PERMISSION_DENIED");
	});

	it("lets the host invoke a private function under private.host allow", async () => {
		api = await slothlet({
			mode,
			base: BASE,
			permissions: { defaultPolicy: "allow", rules: [], private: { host: "allow" } }
		});

		expect(await api.billing.internals._scale(100)).toBe(120);
	});

	it("leaves a root-level underscore MOUNT public", async () => {
		api = await slothlet({ mode, base: BASE, permissions: { defaultPolicy: "allow", rules: [] } });

		// Privacy attaches to a member OF a module. `_toplevel` has no parent segment — it is the
		// mount itself, and calling it must stay as public as traversing it. Denying it would also
		// contradict the surface: `_utils.helper` is documented as a public member, so `_utils`
		// being uncallable would make the mount reachable-through but not usable.
		expect(await api._toplevel()).toBe("mounted");
	});

	it("classifies private names exactly at the manager predicate", async () => {
		const { resolveWrapper } = await import("#handlers/unified-wrapper");
		api = await slothlet({ mode, base: BASE, permissions: { defaultPolicy: "allow", rules: [] } });
		const pm = resolveWrapper(api.billing).slothlet.handlers.permissionManager;

		expect(pm.isPrivateTarget("billing.internals.__rate")).toBe(true);
		expect(pm.isPrivateTarget("billing.internals.currency")).toBe(false);
		// A bare top-level path is a mount, not a member — no parent segment, never private.
		expect(pm.isPrivateTarget("_toplevel")).toBe(false);
		expect(pm.isPrivateTarget("_utils.helper"), "an underscore ROUTE is not a private member").toBe(false);
		// Defensive inputs answer false rather than throwing — the wrapper layer may probe with
		// whatever it holds.
		expect(pm.isPrivateTarget(null)).toBe(false);
		expect(pm.isPrivateTarget("")).toBe(false);
	});

	it("rejects malformed permissions.private config with named errors", async () => {
		await expect(slothlet({ mode, base: BASE, permissions: { private: [] } })).rejects.toThrow(/INVALID_CONFIG/);
		await expect(slothlet({ mode, base: BASE, permissions: { private: { host: "sometimes" } } })).rejects.toThrow(/INVALID_CONFIG/);
	});

	it("refuses a module FILE named for a framework-reserved key", async () => {
		if (mode === "eager") {
			await expect(slothlet({ mode, base: REJECT_FILE })).rejects.toThrow(/MODULE_RESERVED_FILENAME/);
		} else {
			// Lazy defers the scan of subdirectory contents, but the root scan still walks the
			// directory listing — the rejection fires wherever the listing is first read.
			await expect(async () => {
				api = await slothlet({ mode, base: REJECT_FILE });
				await api.ok?.fine;
			}).rejects.toThrow(/MODULE_RESERVED_FILENAME/);
		}
	});

	it("refuses a module EXPORT named for a framework-reserved key", async () => {
		await expect(async () => {
			api = await slothlet({ mode, base: REJECT_EXPORT });
			// Lazy loads the file at first touch; eager rejects at boot. Either way the named
			// error surfaces before the export could compose.
			await api.mod?.fine;
		}).rejects.toThrow(/MODULE_RESERVED_EXPORT/);
	});

	it("lets a `hidden` glob exclude a reserved-name file the mount never loads", async () => {
		api = await slothlet({ mode, base: BASE });

		// Same rule as the fileFilter case: a file the consumer hid never reaches the composed
		// surface, so refusing the whole mount over it contradicts scoping the refusal to loaded
		// files. Hiding it is the documented way to keep such a file in the tree.
		await api.slothlet.api.add("hid", REJECT_FILE, { hidden: "_impl" });
		expect((mode === "lazy" ? await api.hid : api.hid).ok.fine).toBe("fine");
	});

	it("lets a single-file mount past a reserved-name SIBLING it never loads", async () => {
		api = await slothlet({ mode, base: BASE });

		// A single-file `api.add` filters the directory listing down to the one file it wants.
		// A reserved-name sibling that the filter excludes never reaches the composed surface, so
		// it is not this mount's problem — refusing here would make an unrelated file in the same
		// folder block a legitimate mount.
		await api.slothlet.api.add("solo", `${REJECT_FILE}/ok.mjs`);
		expect((mode === "lazy" ? await api.solo : api.solo).fine).toBe("fine");
	});
});

describe("Permissions > reserved-name refusal is platform-symmetric (#260)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("refuses a reserved-name file in a browser manifest too", async () => {
		// The hazard is the composed wrapper shape, not the platform: a manifest carrying
		// `_impl.mjs` would empty the lazy surface in a browser exactly as on disk, so the
		// filesystem scan's refusal has to have a manifest-side twin.
		await expect(
			slothlet({
				base: TEST_DIRS.API_TEST_BROWSER,
				mode: "eager",
				manifest: {
					files: [
						{ path: "math.mjs", name: "math", fullName: "math.mjs" },
						{ path: "_impl.mjs", name: "_impl", fullName: "_impl.mjs" }
					],
					directories: []
				}
			})
		).rejects.toThrow(/MODULE_RESERVED_FILENAME/);
	});

	it("still mounts a manifest with no reserved names", async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST_BROWSER,
			mode: "eager",
			manifest: { files: [{ path: "math.mjs", name: "math", fullName: "math.mjs" }], directories: [] }
		});
		expect(api.math.add(2, 3)).toBe(5);
	});
});
