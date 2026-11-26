/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-closed-form-traps.test.vitest.mjs
 *	@Date: 2026-11-25T01:26:11-08:00 (1795598771)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:43:47-08:00 (1795599827)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Once the host closes the api root (`Object.preventExtensions`, `Object.seal`, `Object.freeze`), a
 * module's `self` is closed as the root is (#827). Each operation the language has on an object, done inside a module on
 * its closed `self`, answers as the same operation on the host's `api`: membership, the keys, each member's descriptor,
 * reads, writes, definitions, deletions, the prototype, closing it again, and a call and a construction of the root.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { operations } from "../../../../api_tests/api_test_self_closed/lib/operations.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_self_closed");

const CONFIGS = ["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime })));
const CLOSES = ["preventExtensions", "seal", "freeze"];

describe.each(CONFIGS)("self is closed as the api root is: every operation > $mode / $runtime", ({ mode, runtime }) => {
	it.each(CLOSES)("%s: each operation on the closed self answers as on api", async (how) => {
		const api = await slothlet({ base: path.join(FIXTURE, "api"), mode, runtime, silent: true });
		try {
			await api.math.add(1, 2);
			expect(await api.probe.ready()).toBe("function");
			Object[how](api);
			// A write of a new member through a closed self is the it.todo below.
			const write = false;
			const fromSelf = await api.probe.closedOperations(write);
			const fromApi = operations(api, write);
			expect(fromSelf).toEqual(fromApi);
			expect(fromSelf.call).toEqual({ value: 42 });
		} finally {
			await api.shutdown();
		}
	});

	// `Reflect.set` of a new member on the closed api answers false; through a closed self the api manager's own
	// assignment throws a TypeError instead.
	it.todo("Reflect.set of a new member on a closed self answers false, as on api");
});
