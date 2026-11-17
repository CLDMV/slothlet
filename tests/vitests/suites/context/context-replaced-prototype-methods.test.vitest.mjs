/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-replaced-prototype-methods.test.vitest.mjs
 *	@Date: 2026-11-17T13:23:26-08:00 (1794950606)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:35:58-08:00 (1794951358)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that replaces a method of a built-in prototype for the whole realm does not steer slothlet:
 * `Object.prototype.hasOwnProperty` made to deny a key cannot make a `protect`ed or `owners` context key writable, a
 * replacement that writes context when slothlet asks it is never run as the owner, and `Promise.prototype.then` made to
 * forge a value does not change what the host gets back from another module's async call.
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = path.resolve(TEST_DIRS.API_TEST_PERMISSIONS, "../api_test_replaced_prototypes");

const ORIGINAL_HAS_OWN = Object.prototype.hasOwnProperty;
const ORIGINAL_THEN = Promise.prototype.then;

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const [label, permissions] of [
			["permissions off", undefined],
			["permissions on", { mode: "on", policy: "allow" }]
		]) {
			CONFIGS.push({ name: `${mode} ${runtime}, ${label}`, config: { mode, runtime, ...(permissions ? { permissions } : {}) } });
		}
	}
}

/**
 * Whether a write threw CONTEXT_KEY_PROTECTED.
 * @param {function(): Promise<*>} write - The write.
 * @returns {Promise<boolean>} True when it was refused.
 */
async function refused(write) {
	try {
		await write();
		return false;
	} catch (error) {
		return /CONTEXT_KEY_PROTECTED/.test(String(error?.code ?? "") + String(error?.message ?? ""));
	}
}

describe("Context > a replaced Object.prototype.hasOwnProperty", () => {
	let api;

	afterEach(async () => {
		Object.prototype.hasOwnProperty = ORIGINAL_HAS_OWN;
		Promise.prototype.then = ORIGINAL_THEN;
		if (api) await api.shutdown();
		api = null;
	});

	describe.each(CONFIGS)("$name", ({ config }) => {
		it("cannot make a protected or owned context key writable", async () => {
			api = await slothlet({ ...config, base: BASE });
			const outcome = {};
			await withSuppressedSlothletErrorOutput(async () => {
				await api.slothlet.context.scope({
					context: { locked: "init", userId: "u-1", auth: { role: "user" } },
					protect: ["locked"],
					owners: { userId: "owner", auth: "owner" },
					fn: async () => {
						await api.tamper.denyOwn(["locked", "userId", "auth"]);
						outcome.locked = await refused(() => api.other.writeContext("locked", "hax"));
						outcome.userId = await refused(() => api.other.writeContext("userId", "u-evil"));
						outcome.role = await refused(() => api.other.writeNested("auth", "role", "admin"));
						Object.prototype.hasOwnProperty = ORIGINAL_HAS_OWN;
						// The owner still writes its own keys.
						outcome.ownerWrote = (await api.owner.writeContext("userId", "u-2")) === "u-2";
					}
				});
			});
			expect(outcome).toEqual({ locked: true, userId: true, role: true, ownerWrote: true });
		});
	});

	it("that writes context when asked is never run as the owner during the owner's call (async runtime, provenance off)", async () => {
		api = await slothlet({
			mode: "eager",
			runtime: "async",
			base: BASE,
			permissions: { mode: "on", policy: "allow", caller: { provenance: false } }
		});
		let ownerWrote = false;
		let report = null;
		await withSuppressedSlothletErrorOutput(async () => {
			await api.slothlet.context.scope({
				context: { userId: "u-1" },
				owners: { userId: "owner" },
				fn: async () => {
					await api.tamper.hijackOwn("userId", "u-evil");
					ownerWrote = (await api.owner.writeContext("userId", "u-2")) === "u-2";
					report = await api.tamper.report();
				}
			});
		});
		expect(ownerWrote).toBe(true);
		// Slothlet's checks never call the replacement, so it never writes as the owner.
		expect(report).toEqual({ calls: 0, landed: 0, refused: 0 });
	});
});

describe("Async results > a replaced Promise.prototype.then", () => {
	let api;

	afterEach(async () => {
		Promise.prototype.then = ORIGINAL_THEN;
		if (api) await api.shutdown();
		api = null;
	});

	it("leaves a plain-JS await of an async function's promise as it was", async () => {
		const fetch = async () => {
			await null;
			return "answer:real";
		};
		Promise.prototype.then = function then(onFulfilled, onRejected) {
			const forging =
				typeof onFulfilled === "function" ? (value) => onFulfilled(value === "answer:real" ? "answer:forged" : value) : onFulfilled;
			return ORIGINAL_THEN.call(this, forging, onRejected);
		};
		const value = await fetch();
		Promise.prototype.then = ORIGINAL_THEN;
		expect(value).toBe("answer:real");
	});

	describe.each(CONFIGS)("$name", ({ config }) => {
		it("does not change what the host gets back from another module's async call", async () => {
			api = await slothlet({ ...config, base: BASE });
			// Materialize the leaf first, so the call below is the module's async call alone.
			expect(await api.answer.fetch()).toBe("answer:real");
			await api.tamper.forgeThen("answer:real", "answer:forged");
			let value;
			try {
				value = await api.answer.fetch();
			} finally {
				Promise.prototype.then = ORIGINAL_THEN;
			}
			expect(value).toBe("answer:real");
		});
	});
});
