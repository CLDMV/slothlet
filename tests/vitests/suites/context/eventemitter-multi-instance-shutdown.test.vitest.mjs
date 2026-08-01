/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-multi-instance-shutdown.test.vitest.mjs
 *	@Date: 2026-08-01 12:00:00 -07:00 (1785610800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-01 12:00:00 -07:00 (1785610800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview One instance's shutdown must not strip another instance's emitters.
 *
 * @description
 * The EventEmitter tracking structures are module-level and span every slothlet instance in the
 * process. Emitter cleanup on shutdown therefore has to be held to the same refcount discipline as
 * the prototype unpatching directly above it: releasing them while a sibling instance is live rips
 * that sibling's listeners off mid-flight and clears the original→wrapped mapping its patched
 * `removeListener` resolves through. The last shutdown still performs the full cleanup, so nothing
 * is leaked once the process is done with slothlet.
 */

import { describe, it, expect, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";
import { BASIC_MATRIX, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(BASIC_MATRIX)("EventEmitter multi-instance shutdown > Config: '$name'", ({ config }) => {
	let apiA;
	let apiB;

	afterEach(async () => {
		if (apiA) await apiA.shutdown();
		if (apiB) await apiB.shutdown();
		apiA = null;
		apiB = null;
	});

	it("keeps a live instance's emitters intact when a sibling instance shuts down", async () => {
		apiB = await slothlet({ ...config, base: TEST_DIRS.API_TEST, context: { user: "b" } });

		// Emitters and listeners created inside B's api context, so they are tracked.
		const before = await apiB.database.pool.createConnections(3);
		expect(before.totalListeners).toBe(12);
		const emitters = await apiB.database.pool.getEmitters();

		// A sibling instance comes and goes. Its shutdown must release only its own share.
		apiA = await slothlet({ ...config, base: TEST_DIRS.API_TEST, context: { user: "a" } });
		await apiA.shutdown();
		apiA = null;

		// B's emitters still carry every listener; the sibling's shutdown released none of them.
		const after = await apiB.database.pool.getStats();
		expect(after.totalListeners).toBe(before.totalListeners);

		// And the deferred release still happens: B's own (last) shutdown strips what B tracked. The
		// sibling's shutdown clearing the tracking sets early would leave these listeners attached for
		// the life of the process — the hanging-process leak the cleanup exists to prevent.
		await apiB.shutdown();
		apiB = null;
		const remaining = emitters.reduce(
			(sum, e) => sum + e.listenerCount("connect") + e.listenerCount("query") + e.listenerCount("error") + e.listenerCount("disconnect"),
			0
		);
		expect(remaining).toBe(0);
	});

	it("keeps a live instance's listener removal working after a sibling shuts down", async () => {
		apiB = await slothlet({ ...config, base: TEST_DIRS.API_TEST, context: { user: "b" } });

		// Registered while patching is active, so the listener on the emitter is the WRAPPED function
		// and only the tracking map can translate the original back to it on removal.
		const emitter = new EventEmitter();
		let fired = 0;
		const handler = () => {
			fired++;
		};
		emitter.on("evt", handler);

		apiA = await slothlet({ ...config, base: TEST_DIRS.API_TEST, context: { user: "a" } });
		await apiA.shutdown();
		apiA = null;

		// If the sibling's shutdown wiped the original→wrapped mapping, this removal silently misses
		// (it removes by the original's identity while the wrapped function stays attached) and the
		// emit below still fires.
		emitter.off("evt", handler);
		emitter.emit("evt");

		expect(emitter.listenerCount("evt")).toBe(0);
		expect(fired).toBe(0);
	});

	it("still performs the full cleanup on the last shutdown", async () => {
		apiB = await slothlet({ ...config, base: TEST_DIRS.API_TEST, context: { user: "b" } });

		await apiB.database.pool.createConnections(2);
		const emitters = await apiB.database.pool.getEmitters();
		expect(emitters.length).toBeGreaterThan(0);

		// Last instance out: the deferred cleanup still runs, so tracked emitters are stripped and
		// nothing keeps the process open.
		await apiB.shutdown();
		apiB = null;

		const remaining = emitters.reduce(
			(sum, e) => sum + e.listenerCount("connect") + e.listenerCount("query") + e.listenerCount("error") + e.listenerCount("disconnect"),
			0
		);
		expect(remaining).toBe(0);
	});
});
