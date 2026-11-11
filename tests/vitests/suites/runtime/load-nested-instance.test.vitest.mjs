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
	}
);
