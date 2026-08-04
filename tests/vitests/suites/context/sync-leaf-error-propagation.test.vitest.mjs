/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/sync-leaf-error-propagation.test.vitest.mjs
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
 * @fileoverview A leaf's thrown value propagates untouched regardless of the leaf's sync-ness (#252).
 *
 * @description
 * A synchronous leaf's throw used to be re-typed as `CONTEXT_EXECUTION_FAILED` while the identical
 * async leaf's rejection propagated untouched — the same leaf, written `function` vs
 * `async function`, had two different error contracts. Structured payloads (`{ statusCode, key }`,
 * the standard HTTP-mapping shape) lost their status code and arrived at error boundaries as
 * generic internal failures; at production scale every raised 4xx returned 500 and key-branching
 * fault handlers inverted. The contract pinned here: the normal leaf call path never re-types what
 * application code throws — any value, either sync-ness, every mode × runtime combination.
 *
 * The manager-level wrap is intentionally NOT removed (a defensive boundary for direct
 * `runInContext` consumers); its own suite pins that. What it wraps must now chain the original via
 * the standard ES2022 `cause` and render a non-`Error` payload in its message rather than an empty
 * slot — pinned at the end of this file.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { AsyncContextManager } from "#handlers/context-async";
import { LiveContextManager } from "#handlers/context-live";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

// A minimal boot base; the throwing module itself is mounted inline via api.add().
const BASE = new URL("../../../../api_tests/api_test_underscore", import.meta.url).pathname;

const PAYLOAD = { statusCode: 403, error: "forbidden", key: "err.forbidden" };

/** Inline module mirroring the #252 repro: identical throws from a sync and an async leaf. */
const THROWERS = {
	exports: {
		/**
		 * Synchronous leaf throwing a framework-style structured payload.
		 * @returns {never} Always throws.
		 */
		syncThrow() {
			throw { ...PAYLOAD };
		},
		/**
		 * Asynchronous twin of {@link syncThrow} — the contract both must share.
		 * @returns {Promise<never>} Always rejects.
		 */
		async asyncThrow() {
			throw { ...PAYLOAD };
		},
		/**
		 * Synchronous leaf throwing a real Error instance, for identity preservation.
		 * @returns {never} Always throws.
		 */
		syncThrowError() {
			const err = new Error("boom-sync");
			err.statusCode = 418;
			throw err;
		}
	}
};

describe.each(getMatrixConfigs())("Context > leaf throws propagate untouched (#252) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("propagates a sync leaf's structured payload with identity intact", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.slothlet.api.add("svc", THROWERS);

		let caught = null;
		try {
			await api.svc.syncThrow();
		} catch (e) {
			caught = e;
		}
		expect(caught, "the throw must surface").not.toBeNull();
		// The payload arrives as thrown — not re-typed, nothing stripped.
		expect(caught.statusCode, "statusCode survives").toBe(403);
		expect(caught.key, "key survives").toBe("err.forbidden");
		expect(caught.code, "no framework re-typing").not.toBe("CONTEXT_EXECUTION_FAILED");
	});

	it("gives sync and async leaves the same error contract", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.slothlet.api.add("svc", THROWERS);

		const catchFrom = async (fn) => {
			try {
				await fn();
				return null;
			} catch (e) {
				return e;
			}
		};
		const syncCaught = await catchFrom(() => api.svc.syncThrow());
		const asyncCaught = await catchFrom(() => api.svc.asyncThrow());

		// One error-handling path must work for both — the asymmetry was the bug.
		expect(syncCaught.statusCode, "sync").toBe(asyncCaught.statusCode);
		expect(syncCaught.key).toBe(asyncCaught.key);
		expect(Object.keys(syncCaught).sort()).toEqual(Object.keys(asyncCaught).sort());
	});

	it("preserves a thrown Error instance's identity and own fields", async () => {
		api = await slothlet({ ...config, base: BASE });
		await api.slothlet.api.add("svc", THROWERS);

		let caught = null;
		try {
			await api.svc.syncThrowError();
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(Error);
		expect(caught.message).toBe("boom-sync");
		expect(caught.statusCode, "custom fields ride along").toBe(418);
		expect(caught.name, "not re-typed").not.toBe("SlothletError");
	});
});

describe("Context > the retained manager-level wrap chains and renders its cause (#252)", () => {
	it("sets the standard `cause` and keeps `originalError` for compatibility", () => {
		// Direct manager use is the boundary the wrap still guards; the wrap itself must follow
		// ES2022 chaining so util.inspect / serializers / lint walkers reach the original.
		const cm = new AsyncContextManager();
		cm.initialize("inst-cause");

		let caught = null;
		try {
			cm.runInContext("inst-cause", () => {
				throw { ...PAYLOAD };
			});
		} catch (e) {
			caught = e;
		}
		expect(caught.code).toBe("CONTEXT_EXECUTION_FAILED");
		expect(caught.cause, "standard chaining channel").toEqual(PAYLOAD);
		expect(caught.originalError, "compat channel").toEqual(PAYLOAD);
	});

	it("renders a non-Error thrown value in the message instead of an empty slot", () => {
		const cm = new AsyncContextManager();
		cm.initialize("inst-render");

		let caught = null;
		try {
			cm.runInContext("inst-render", () => {
				throw { ...PAYLOAD };
			});
		} catch (e) {
			caught = e;
		}
		// The diagnostic that replaced the error must name it: the payload's content appears in the
		// message rather than `…instance 'x':` trailing into nothing.
		expect(caught.message).toContain("403");
		expect(caught.message).toContain("forbidden");
	});

	it("renders every thrown kind: string as itself, unserializable via String()", () => {
		const cm = new AsyncContextManager();
		cm.initialize("inst-kinds");

		const wrapOf = (thrower) => {
			try {
				cm.runInContext("inst-kinds", thrower);
				return null;
			} catch (e) {
				return e;
			}
		};
		// A bare string throw is itself the rendering.
		expect(
			wrapOf(() => {
				throw "plain-string-reason";
			}).message
		).toContain("plain-string-reason");
		// JSON.stringify of a function is undefined, so the String() fallback carries the
		// rendering. (A falsy throw like `undefined` never reaches the renderer at all — the
		// constructor treats it as no-original.)
		expect(
			wrapOf(() => {
				// eslint-disable-next-line no-throw-literal
				throw function namedThrown() {};
			}).message
		).toContain("namedThrown");
	});

	it("wraps at the LIVE manager boundary identically to the async one", () => {
		// The live runtime mirrors the async manager's defensive wrap; the leaf-path change must not
		// have hollowed it out — a direct consumer's throw still wraps, chains, and renders there.
		const cm = new LiveContextManager();
		cm.initialize("inst-live");

		let caught = null;
		try {
			cm.runInContext("inst-live", () => {
				throw { ...PAYLOAD };
			});
		} catch (e) {
			caught = e;
		}
		expect(caught.code).toBe("CONTEXT_EXECUTION_FAILED");
		expect(caught.cause).toEqual(PAYLOAD);
		expect(caught.message).toContain("403");
	});
});

describe("Context > error hooks unwrap an application-thrown SlothletError (#252)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("hands the error hook the root cause a module packed into its own SlothletError", async () => {
		// Leaf errors now arrive at the hook pipeline raw, so the unwrap step's remaining job is a
		// module deliberately throwing a SlothletError that CARRIES an original — the hook must see
		// the root cause, not the wrapper.
		const { SlothletError } = await import("@cldmv/slothlet/errors");
		const rootCause = new Error("root-cause");
		api = await slothlet({ mode: "eager", base: BASE, hook: { enabled: true } });
		await api.slothlet.api.add("svc", {
			exports: {
				/**
				 * Leaf packing a root cause into a framework-shaped error of its own.
				 * @returns {never} Always throws.
				 */
				packedThrow() {
					throw new SlothletError("CONTEXT_EXECUTION_FAILED", { instanceID: "app-made" }, rootCause);
				}
			}
		});

		const seen = [];
		api.slothlet.hook.on(
			"svc.packedThrow:error",
			({ error }) => {
				seen.push(error);
			},
			{ id: "unwrap-witness" }
		);

		await expect(async () => await api.svc.packedThrow()).rejects.toThrow();
		expect(seen, "error hook fired once").toHaveLength(1);
		expect(seen[0], "hook sees the root cause, not the wrapper").toBe(rootCause);
	});
});
