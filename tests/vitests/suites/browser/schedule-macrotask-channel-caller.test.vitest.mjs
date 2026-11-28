/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/browser/schedule-macrotask-channel-caller.test.vitest.mjs
 *	@Date: 2026-11-25T08:39:50-08:00 (1795624790)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:17-08:00 (1795869077)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `scheduleMacrotask` runs its callback as the caller that scheduled it on every path it takes.
 *
 * @description
 * The `setImmediate` and `setTimeout` paths pin the callback themselves. The `MessageChannel` path (browsers and
 * workers) handed the bare callback to the port's `onmessage`, and only ran as the caller when something on the port's
 * delivery path pinned it. Each path is driven here with schedulers nothing else wraps, so the callback has only
 * `scheduleMacrotask`'s own pinning to rely on.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { context } from "@cldmv/slothlet/runtime";
import { scheduleMacrotask } from "#helpers/platform";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// The host's own `setTimeout`, taken before any instance in this file starts and patches the global one.
const hostSetTimeout = globalThis.setTimeout;

/**
 * A channel whose `port1.onmessage` is a plain property, and whose delivery goes through the host's own timer: nothing
 * slothlet patches sits between the post and the handler, so the handler runs as whatever `scheduleMacrotask` made it.
 */
class PlainChannel {
	constructor() {
		const port1 = { onmessage: null, close: () => {} };
		this.port1 = port1;
		this.port2 = { postMessage: (data) => hostSetTimeout(() => port1.onmessage?.({ data }), 0) };
	}
}

const HOSTS = {
	setImmediate: { setImmediate, MessageChannel: PlainChannel, setTimeout: hostSetTimeout },
	MessageChannel: { setImmediate: undefined, MessageChannel: PlainChannel, setTimeout: hostSetTimeout },
	setTimeout: { setImmediate: undefined, MessageChannel: undefined, setTimeout: hostSetTimeout }
};

/** What the callback sees of the context: the user, or the error code reading it threw. */
const seen = () => {
	try {
		return context.user ?? null;
	} catch (error) {
		return error?.code ?? "threw";
	}
};

describe.each(getMatrixConfigs())("scheduleMacrotask runs the callback as its caller > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each(Object.keys(HOSTS))("the %s path", async (path) => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
		await api.slothlet.api.add("probe", {
			later: () => new Promise((resolve) => scheduleMacrotask(() => resolve(seen()), HOSTS[path]))
		});
		expect(await api.slothlet.context.run({ user: "alice" }, () => api.probe.later())).toBe("alice");
	});
});
