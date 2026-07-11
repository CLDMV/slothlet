/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-owner-locked-keys.test.vitest.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview H5 — owner-locked / protected context keys (opt-in). `scope({ protect })` locks a
 * context key write-once/unowned; `scope({ owners })` binds a key to a named owner (a module apiPath).
 * A runtime `context` write that the caller doesn't own throws CONTEXT_KEY_PROTECTED, and a nested
 * scope() cannot re-own a key another owner already holds (CONTEXT_KEY_OWNED). Declared only via
 * scope()/run() options — never via run()'s positional args.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Context > Owner-locked keys (H5) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("protected key write from a leaf throws CONTEXT_KEY_PROTECTED; unprotected key is unaffected", async () => {
		api = await slothlet({ ...config, base: BASE });

		let protectedThrew = false;
		let openWrote = false;
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { locked: "init", open: "x" },
				protect: ["locked"],
				fn: async () => {
					openWrote = (await api.callers.dataReader.writeContext("open", "ok")) === "ok"; // regression: unprotected
					try {
						await api.callers.dataReader.writeContext("locked", "hax");
					} catch (err) {
						protectedThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
				}
			});
		});
		expect(openWrote).toBe(true);
		expect(protectedThrew).toBe(true);
	});

	it("named-owner write succeeds for the owner and throws for the wrong module", async () => {
		api = await slothlet({ ...config, base: BASE });

		let ownerWrote = false;
		let wrongThrew = false;
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { secret: "s" },
				owners: { secret: "callers.dataReader" },
				fn: async () => {
					ownerWrote = (await api.callers.dataReader.writeContext("secret", "new")) === "new";
					try {
						await api.callers.dataReaderB.writeContext("secret", "evil");
					} catch (err) {
						wrongThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
				}
			});
		});
		expect(ownerWrote).toBe(true);
		expect(wrongThrew).toBe(true);
	});

	it("a nested scope() cannot re-own a key already owned (CONTEXT_KEY_OWNED)", async () => {
		api = await slothlet({ ...config, base: BASE });

		let reownThrew = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.scope({
					context: { k: 1 },
					owners: { k: "callers.dataReader" },
					fn: async () => {
						await api.slothlet.scope({ context: {}, owners: { k: "callers.dataReaderB" }, fn: () => {} });
					}
				});
			} catch (err) {
				reownThrew = /CONTEXT_KEY_OWNED/.test(err.message);
			}
		});
		expect(reownThrew).toBe(true);
	});

	it("a non-string or empty-string `owners` value throws INVALID_ARGUMENT", async () => {
		api = await slothlet({ ...config, base: BASE });

		let nonStringThrew = false;
		let emptyStringThrew = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.scope({ context: { secret: "s" }, owners: { secret: 123 }, fn: () => {} });
			} catch (err) {
				nonStringThrew = /INVALID_ARGUMENT/.test(err.message);
			}
			try {
				await api.slothlet.scope({ context: { secret: "s" }, owners: { secret: "" }, fn: () => {} });
			} catch (err) {
				emptyStringThrew = /INVALID_ARGUMENT/.test(err.message);
			}
		});
		expect(nonStringThrew).toBe(true);
		expect(emptyStringThrew).toBe(true);
	});

	it("a key named by both `protect` and `owners` in the same scope() call is rejected, not silently double-claimed (CONTEXT_KEY_OWNED)", async () => {
		api = await slothlet({ ...config, base: BASE });

		let collisionThrew = false;
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.scope({
					context: { k: 1 },
					protect: ["k"],
					owners: { k: "callers.dataReader" },
					fn: () => {}
				});
			} catch (err) {
				collisionThrew = /CONTEXT_KEY_OWNED/.test(err.message);
			}
		});
		expect(collisionThrew).toBe(true);
	});

	// PR #195 review (C1, SECURITY): the ownership map is built with a null prototype and every
	// lookup goes through hasOwnProperty, so a caller-supplied "__proto__"/"constructor" key cannot be
	// misread as an already-owned key via an inherited Object.prototype property, and cannot mutate
	// the map's prototype. Before the fix, claiming either key threw a false-positive CONTEXT_KEY_OWNED
	// on its very first use (the plain-object map's `child?.[key]` read walked the prototype chain).
	it('a `protect` key of "__proto__" or "constructor" claims cleanly (no false CONTEXT_KEY_OWNED) and stays enforced, without polluting Object.prototype', async () => {
		api = await slothlet({ ...config, base: BASE });

		for (const trickyKey of ["__proto__", "constructor"]) {
			let claimedCleanly = false;
			let protectedAsSentinel = false;
			await withSuppressedSlothletErrorOutput(async () => {
				await api.slothlet.scope({
					context: { [trickyKey]: "init" },
					protect: [trickyKey],
					fn: async () => {
						claimedCleanly = true; // reaching here means buildContextOwners did NOT
						// false-positive CONTEXT_KEY_OWNED on the first-ever claim of this key
						try {
							await api.callers.dataReader.writeContext(trickyKey, "hax");
						} catch (err) {
							// Must be denied as the PROTECT_SENTINEL write-once lock specifically
							// (message reports "owner: protected") — not merely CONTEXT_KEY_PROTECTED
							// for the wrong reason (a plain-object map reading an inherited
							// Object.prototype value as the "owner" would also throw
							// CONTEXT_KEY_PROTECTED, but with "owner: [object Object]").
							protectedAsSentinel = /CONTEXT_KEY_PROTECTED/.test(err.message) && err.message.includes("(owner: protected)");
						}
					}
				});
			});
			expect(claimedCleanly).toBe(true);
			expect(protectedAsSentinel).toBe(true);
		}

		// The ownership-map machinery must never touch the real Object.prototype.
		expect(Object.getPrototypeOf(Object.prototype)).toBe(null);
		expect(Object.prototype.constructor).toBe(Object);
		expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")).toBe(false);
	});

	it('an `owners` key of "__proto__" or "constructor" behaves as a normal owned key: the named owner can write, another module cannot, and Object.prototype stays clean', async () => {
		api = await slothlet({ ...config, base: BASE });

		for (const trickyKey of ["__proto__", "constructor"]) {
			let ownerWrote = false;
			let wrongThrew = false;
			await withSuppressedSlothletErrorOutput(async () => {
				await api.slothlet.scope({
					context: { [trickyKey]: "init" },
					owners: { [trickyKey]: "callers.dataReader" },
					fn: async () => {
						ownerWrote = (await api.callers.dataReader.writeContext(trickyKey, "new")) === "new";
						try {
							await api.callers.dataReaderB.writeContext(trickyKey, "evil");
						} catch (err) {
							wrongThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
						}
					}
				});
			});
			expect(ownerWrote).toBe(true);
			expect(wrongThrew).toBe(true);
		}

		expect(Object.getPrototypeOf(Object.prototype)).toBe(null);
		expect(Object.prototype.constructor).toBe(Object);
	});

	// PR #195 review (C2, DX): SCOPE_INVALID_PROTECT / SCOPE_INVALID_OWNERS used to report a bare
	// `typeof`, which is "object" for both an array and an array holding a non-string entry — useless
	// for the two most common mistakes. `received` is now a descriptive string instead.
	it('SCOPE_INVALID_OWNERS reports a descriptive `received` for an array, not the bare "object"', async () => {
		api = await slothlet({ ...config, base: BASE });

		let message = "";
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.scope({ context: {}, owners: ["not", "a", "plain", "object"], fn: () => {} });
			} catch (err) {
				message = err.message;
			}
		});
		expect(message).toMatch(/SCOPE_INVALID_OWNERS/);
		expect(message).toContain("Received: array.");
		expect(message).not.toContain("Received: object.");
	});

	it('SCOPE_INVALID_PROTECT reports a descriptive `received` for an array with a non-string entry, not the bare "object"', async () => {
		api = await slothlet({ ...config, base: BASE });

		let message = "";
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.scope({ context: {}, protect: ["ok", 123], fn: () => {} });
			} catch (err) {
				message = err.message;
			}
		});
		expect(message).toMatch(/SCOPE_INVALID_PROTECT/);
		expect(message).toContain("Received: array with non-string entry (number at index 1).");
	});
});
