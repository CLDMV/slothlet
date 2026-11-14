/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/load-nested-instance.test.vitest.mjs
 *	@Date: 2026-11-11T14:13:00-08:00 (1794435180)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T14:26:40-08:00 (1794436000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file that builds another slothlet instance while it loads can use what that instance hands out.
 *
 * @description
 * What a file starts while it loads carries the file's module as its caller. That holds for the loading instance's own
 * code only: a function another instance handed out, run from a timer the loading file started, is that other
 * instance's code and reads its own `self`, as it does when plain code runs it.
 * @module tests/vitests/suites/runtime/load-nested-instance
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import slothlet from "@cldmv/slothlet";

const OUTER = resolve("api_tests/api_test_load_nested/outer");
const INNER = resolve("api_tests/api_test_load_nested/inner");
const CHANGES = ["writeSync", "writeAfterAwait", "readAfterAwait", "removeAfterAwait", "defineAfterAwait"];
/** What each change answers for a module changing the top level of its own `self` inside its call. */
const EXPECTED = { writeSync: "ok", writeAfterAwait: "ok", readAfterAwait: "function", removeAfterAwait: "ok", defineAfterAwait: "ok" };

describe.each(["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime }))))(
	"an instance built while a file loads > $mode / $runtime",
	({ mode, runtime }) => {
		let api;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			api = null;
		});

		it("runs what the inner instance handed out as that instance's code", async () => {
			api = await slothlet({ base: OUTER, mode, runtime, silent: true });
			expect(await api.nested.loaded()).toBe(true);
			// Plain JavaScript: the inner instance's closure calls its own `self.other.ping()`.
			expect(await api.nested.answered).toBe("pong");
		});

		it("lets the inner instance's functions change their own self, on either runtime, as when the host builds it", async () => {
			// The reference: the same inner instance built by the host itself, outside any file's load.
			const reference = {};
			for (const innerRuntime of ["async", "live"]) {
				const inner = await slothlet({ base: INNER, runtime: innerRuntime, silent: true });
				reference[innerRuntime] = {};
				for (const change of CHANGES) reference[innerRuntime][change] = await inner.writer[change]();
				await inner.slothlet.shutdown();
			}
			expect(reference).toEqual({ async: EXPECTED, live: EXPECTED });
			api = await slothlet({ base: OUTER, mode, runtime, silent: true });
			const { own, ...inner } = await api.nestedwrites.outcomes();
			expect(inner).toEqual(reference);
			// The loading file's own read of `self` answers the same with a call of an inner instance waiting as without one.
			expect(own.async).toBe(own.alone);
			expect(own.live).toBe(own.alone);
		});
	}
);
