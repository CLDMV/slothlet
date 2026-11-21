/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-promise-flow-managers.test.vitest.mjs
 *	@Date: 2026-11-17T21:31:11-08:00 (1794979871)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T21:34:52-08:00 (1794980092)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Two live context managers with instances at the same time each follow their own flows across promises.
 *
 * @description
 * Every manager with a live instance installs the engine's promise hooks, and the engine runs every installed hook for
 * every promise. Each manager records a promise's flow on the promise in a private field. When all managers shared one
 * field, the second manager's record on a promise threw `Cannot initialize #record twice on the same object` out of the
 * engine's init hook and took the process down at the first promise made after both had an instance.
 */
import { describe, it, expect, afterEach } from "vitest";
import { LiveContextManager } from "#handlers/context-live";

describe("LiveContextManager — two managers with live instances at once", () => {
	const made = [];

	afterEach(() => {
		for (const [manager, id] of made.splice(0)) manager.cleanup(id);
	});

	/**
	 * A manager with one instance, cleaned up after the test.
	 * @param {string} id - The instance id.
	 * @returns {LiveContextManager} The manager.
	 */
	function managerWith(id) {
		const manager = new LiveContextManager();
		manager.initialize(id);
		made.push([manager, id]);
		return manager;
	}

	it("makes and awaits promises with both managers' hooks installed", async () => {
		managerWith("flow-managers-a");
		managerWith("flow-managers-b");

		await expect(Promise.resolve(1).then((value) => value + 1)).resolves.toBe(2);
	});

	it("keeps each manager's own instance active after an await inside its call", async () => {
		const first = managerWith("flow-managers-c");
		const second = managerWith("flow-managers-d");

		const [inFirst, inSecond] = await Promise.all([
			first.runInContext(
				"flow-managers-c",
				async () => {
					await Promise.resolve();
					return first.currentInstanceID;
				},
				null,
				[]
			),
			second.runInContext(
				"flow-managers-d",
				async () => {
					await Promise.resolve();
					return second.currentInstanceID;
				},
				null,
				[]
			)
		]);

		expect(inFirst).toBe("flow-managers-c");
		expect(inSecond).toBe("flow-managers-d");
	});
});
