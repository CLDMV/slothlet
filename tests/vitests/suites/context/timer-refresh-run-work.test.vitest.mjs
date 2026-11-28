/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/timer-refresh-run-work.test.vitest.mjs
 *	@Date: 2026-11-22T18:00:00-08:00 (1795399200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:36-08:00 (1795869096)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A timer a run set and re-armed with `refresh()` from its own callback is still the run's work when it
 * fires again.
 *
 * @description
 * A one-shot timer set in a `run()` is counted as the run's work until it has fired. `timer.refresh()` called from the
 * callback arms the same timer again, and its second firing runs the same callback, in the same run. The run's copy of
 * the instance (here, the metadata it wrote) must still be there when it does.
 */

import { describe, it, expect, afterEach } from "vitest";
import { runCopyCounts } from "#helpers/flow-stores";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each([
	{ runtime: "async", mode: "eager" },
	{ runtime: "live", mode: "eager" },
	{ runtime: "async", mode: "lazy" },
	{ runtime: "live", mode: "lazy" }
])("timer refresh() in a run > $runtime/$mode", (config) => {
	let api;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	it("runs the re-armed callback with the run's copy still in place", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
		await api.math.add(1, 2);
		const tag = () => api.slothlet.metadata.get(api.math.add).tag ?? null;
		const seen = await new Promise((resolve) => {
			api.slothlet.context.run({ user: "refresh" }, () => {
				api.slothlet.metadata.global("tag", "run");
				let firings = 0;
				const timer = setTimeout(() => {
					if (firings++ === 0) {
						timer.refresh();
						return;
					}
					resolve({ firings, tag: tag() });
				}, 40);
			});
		});
		expect(seen.firings).toBe(2);
		expect(seen.tag).toBe("run");
		expect(tag()).toBeNull();
	});

	it("releases the run once the re-armed timer has fired", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
		await api.math.add(1, 2);
		const before = runCopyCounts().runs;
		await new Promise((resolve) => {
			api.slothlet.context.run({}, () => {
				api.slothlet.metadata.global("tag", "run");
				let firings = 0;
				const timer = setTimeout(() => {
					if (firings++ === 0) return void timer.refresh();
					resolve();
				}, 20);
			});
		});
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(runCopyCounts().runs).toBe(before);
	});
});
