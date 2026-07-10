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
});
