/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-symbol-key.test.vitest.mjs
 *	@Date: 2026-05-17T00:00:00-07:00 (1779087600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-17 00:00:00 -07:00 (1779087600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The runtime `self` set trap handles Symbol-keyed assignments.
 *
 * `self[someSymbol] = value` inside an API module must set the symbol-keyed
 * property itself. String keys are routed through
 * `apiManager.setOwnedProperty(String(prop), …)` for apiPath ownership
 * validation — a Symbol would stringify to `"Symbol(…)"` and set THAT string
 * key instead of the symbol-keyed property. The set trap fast-paths symbols
 * straight to `ctx.self`, bypassing ownership validation (symbols are never
 * apiPaths). Verified under both the `live` and `async` runtimes — each has
 * its own `self` set trap (runtime-livebindings.mjs / runtime-asynclocalstorage.mjs).
 *
 * The write is driven through the `owner` API-module fixture
 * (`api_tests/api_test_self_assign/owner.mjs`).
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";

const DIR = "./api_tests/api_test_self_assign";

describe("self[symbol] = … (set-trap symbol fast-path)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	for (const runtime of ["live", "async"]) {
		it(`sets the symbol-keyed property without stringifying the key (${runtime} runtime)`, async () => {
			api = await slothlet({ base: DIR, mode: "eager", runtime });

			// owner.writeSymbolKey() does `self[Symbol(...)] = value` then reads
			// the same symbol back. Without the fast-path the assignment lands on
			// a stringified `"Symbol(...)"` key and the symbol read-back is
			// undefined.
			const result = await api.owner.writeSymbolKey("sym-value");

			expect(result.readBack).toBe("sym-value"); // symbol-keyed property set + read back
			expect(result.stringKeyLeaked).toBe(false); // no "Symbol(...)" string key created
		});
	}
});
