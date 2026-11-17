/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-vitest-runner-compile.test.vitest.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview vitest's own compile of a module file, with the permission system on, under slothlet's vite plugin
 * (forks pool).
 *
 * vitest compiles each module file with `vm.runInThisContext`, which `capability:code` refuses to module code. The
 * plugin's worker setup records the code vitest's server sends; the compile of exactly that code, for a file the
 * instance is loading, is the loader's own and goes through, once per reply. Module code compiling under the file's
 * name is still refused: its own source, the recorded code replayed with imports it chose, and a fetch reply it
 * changed before vitest's runner read it.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VITEST_RUNNER_COMPILE;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe("vitest runner compile — the worker setup", () => {
	it("publishes a frozen verifier on a fixed global slot in a forks worker", () => {
		const slot = Symbol.for("@cldmv/slothlet.vitestFetched");
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, slot);
		expect(descriptor).toMatchObject({ writable: false, configurable: false });
		expect(Object.isFrozen(descriptor.value)).toBe(true);
		expect(typeof descriptor.value.verify).toBe("function");
		// Code no server reply recorded for that name does not verify.
		expect(descriptor.value.verify("/nowhere.mjs", "'use strict';async ()=>{{1\n}}")).toBe(false);
	});
});

describe.each(CONFIGS)("vitest runner compile — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	it("loads a module file with the permission system on, and refuses the file's code compiling under its name", async () => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: {} });
		// The file loading at all is vitest's genuine compile verifying under the vitest in use.
		const report = await withSuppressedSlothletErrorOutput(() => api.probe.result());
		expect(report).toEqual({
			runner: true,
			ownCodeAtPath: "CAPABILITY_REFUSED",
			ownCodeAtId: "CAPABILITY_REFUSED",
			replay: "CAPABILITY_REFUSED",
			forged: "CAPABILITY_REFUSED",
			forgedRan: false,
			replayRan: false
		});
	});
});
