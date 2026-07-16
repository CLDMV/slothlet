/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-nested-protection.test.vitest.mjs
 *	@Date: 2026-07-15 00:00:00 -07:00 (1784098800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-15 00:00:00 -07:00 (1784098800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #207 — `protect`/`owners` guard NESTED context values, not just the top layer.
 *
 * `scope({ protect })` / `scope({ owners })` lock a context key. Before #207 the lock stopped at the
 * first layer: `context.auth = x` threw, but `context.auth.userId = x` (a write to a nested field of a
 * protected key) silently succeeded. The runtime `context` proxy now returns a recursive "protected
 * view" for owner-locked keys whose value is a plain object or array, so a nested write routes through
 * the same owner check and throws CONTEXT_KEY_PROTECTED (carrying the full path, e.g. `auth.userId`).
 * Guarding is scoped to protected/owned keys only — unprotected keys stay fully runtime-mutable — and
 * non-plain objects (Date/Map/class instances) are returned raw (a documented caveat).
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { context as runtimeContext } from "@cldmv/slothlet/runtime";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Context > Nested protection (#207) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("a nested-field write to a protected key throws CONTEXT_KEY_PROTECTED (leaf writer); the value is unchanged", async () => {
		api = await slothlet({ ...config, base: BASE });

		let threw = false;
		let message = "";
		let unchanged = false;
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { auth: { userId: "real" } },
				protect: ["auth"],
				fn: async () => {
					try {
						await api.callers.dataReader.writeNestedContext("auth", "userId", "victim");
					} catch (err) {
						threw = /CONTEXT_KEY_PROTECTED/.test(err.message);
						message = err.message;
					}
					unchanged = (await api.callers.dataReader.readNestedContext("auth", "userId")) === "real";
				}
			});
		});
		expect(threw).toBe(true);
		expect(message).toContain("auth.userId"); // the full path is reported, not just the top key
		expect(unchanged).toBe(true);
	});

	it("a nested read through a protected key still returns the value", async () => {
		api = await slothlet({ ...config, base: BASE });

		let value;
		await api.slothlet.scope({
			context: { auth: { userId: "real" } },
			protect: ["auth"],
			fn: async () => {
				value = await api.callers.dataReader.readNestedContext("auth", "userId");
			}
		});
		expect(value).toBe("real");
	});

	it("a HOST nested write to a protected key throws, reporting the path and 'host'", async () => {
		api = await slothlet({ ...config, base: BASE });

		let threw = false;
		let message = "";
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { auth: { userId: "real" } },
				protect: ["auth"],
				fn: async () => {
					try {
						runtimeContext.auth.userId = "victim";
					} catch (err) {
						threw = /CONTEXT_KEY_PROTECTED/.test(err.message);
						message = err.message;
					}
				}
			});
		});
		expect(threw).toBe(true);
		expect(message).toContain("auth.userId");
		expect(message).toContain("'host' cannot write it");
		expect(message).toContain("(owner: protected)");
	});

	it("a DEEP (2-level) nested write to a protected key throws, reporting the full path (recursive wrapping)", async () => {
		api = await slothlet({ ...config, base: BASE });

		let threw = false;
		let message = "";
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { auth: { profile: { name: "real" } } },
				protect: ["auth"],
				fn: async () => {
					try {
						runtimeContext.auth.profile.name = "victim";
					} catch (err) {
						threw = /CONTEXT_KEY_PROTECTED/.test(err.message);
						message = err.message;
					}
				}
			});
		});
		expect(threw).toBe(true);
		expect(message).toContain("auth.profile.name");
	});

	it("delete and Object.defineProperty on a protected key's nested field both throw", async () => {
		api = await slothlet({ ...config, base: BASE });

		let deleteThrew = false;
		let defineThrew = false;
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { auth: { userId: "real" } },
				protect: ["auth"],
				fn: async () => {
					try {
						delete runtimeContext.auth.userId;
					} catch (err) {
						deleteThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
					try {
						Object.defineProperty(runtimeContext.auth, "userId", { value: "victim" });
					} catch (err) {
						defineThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
				}
			});
		});
		expect(deleteThrew).toBe(true);
		expect(defineThrew).toBe(true);
	});

	it("array mutation (index set + push) on a protected key throws; the array is unchanged", async () => {
		api = await slothlet({ ...config, base: BASE });

		let indexThrew = false;
		let pushThrew = false;
		let unchanged = false;
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { roles: ["user"] },
				protect: ["roles"],
				fn: async () => {
					try {
						runtimeContext.roles[0] = "admin";
					} catch (err) {
						indexThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
					try {
						runtimeContext.roles.push("admin");
					} catch (err) {
						pushThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
					unchanged = runtimeContext.roles.length === 1 && runtimeContext.roles[0] === "user";
				}
			});
		});
		expect(indexThrew).toBe(true);
		expect(pushThrew).toBe(true);
		expect(unchanged).toBe(true);
	});

	it("value-type policy: plain object + array are wrapped (nested writes throw); string, null, and Date are returned raw", async () => {
		api = await slothlet({ ...config, base: BASE });

		const t = 1700000000000;
		let objThrew = false;
		let arrThrew = false;
		let strRaw = false;
		let nullRaw = false;
		let dateRaw = false;
		let dateMethodWorks = false;
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { pObj: { a: 1 }, arr: [1], str: "s", nul: null, at: new Date(t) },
				protect: ["pObj", "arr", "str", "nul", "at"],
				fn: async () => {
					try {
						runtimeContext.pObj.a = 2;
					} catch (err) {
						objThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
					try {
						runtimeContext.arr[0] = 2;
					} catch (err) {
						arrThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
					strRaw = runtimeContext.str === "s";
					nullRaw = runtimeContext.nul === null;
					dateRaw = runtimeContext.at instanceof Date;
					dateMethodWorks = runtimeContext.at.getTime() === t; // not wrapped → real Date receiver
				}
			});
		});
		expect(objThrew).toBe(true);
		expect(arrThrew).toBe(true);
		expect(strRaw).toBe(true);
		expect(nullRaw).toBe(true);
		expect(dateRaw).toBe(true);
		expect(dateMethodWorks).toBe(true);
	});

	it("repeated reads of a protected key return the same view (identity is stable / memoized)", async () => {
		api = await slothlet({ ...config, base: BASE });

		let stable = false;
		await api.slothlet.scope({
			context: { auth: { userId: "real" } },
			protect: ["auth"],
			fn: async () => {
				stable = runtimeContext.auth === runtimeContext.auth;
			}
		});
		expect(stable).toBe(true);
	});

	it("a named owner may write / delete / define a nested field it owns; a different module may not", async () => {
		api = await slothlet({ ...config, base: BASE });

		let ownerWrote = false;
		let ownerDeleted = false;
		let ownerDefined = false;
		let wrongThrew = false;
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.scope({
				context: { cfg: { timeout: 1, drop: "x" } },
				owners: { cfg: "callers.dataReader" },
				fn: async () => {
					ownerWrote = (await api.callers.dataReader.writeNestedContext("cfg", "timeout", 5)) === 5;
					await api.callers.dataReader.deleteNestedContext("cfg", "drop");
					ownerDeleted = (await api.callers.dataReader.readNestedContext("cfg", "drop")) === undefined;
					ownerDefined = (await api.callers.dataReader.defineNestedContext("cfg", "added", 9)) === 9;
					try {
						await api.callers.dataReaderB.writeNestedContext("cfg", "timeout", 99);
					} catch (err) {
						wrongThrew = /CONTEXT_KEY_PROTECTED/.test(err.message);
					}
				}
			});
		});
		expect(ownerWrote).toBe(true);
		expect(ownerDeleted).toBe(true);
		expect(ownerDefined).toBe(true);
		expect(wrongThrew).toBe(true);
	});

	it("nested writes to an UNPROTECTED key are unaffected (only protected/owned keys are guarded)", async () => {
		api = await slothlet({ ...config, base: BASE });

		let wrote = false;
		await api.slothlet.scope({
			context: { open: { x: 1 }, locked: { y: 1 } },
			protect: ["locked"],
			fn: async () => {
				runtimeContext.open.x = 2; // `open` is not protected → the nested write lands
				wrote = runtimeContext.open.x === 2;
			}
		});
		expect(wrote).toBe(true);
	});
});
