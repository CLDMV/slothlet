/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/events/watcher.mjs
 *	@Date: 2026-02-17T06:50:24-08:00 (1771339824)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:29-07:00 (1791090869)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview File watcher module using chokidar EventEmitter for testing EventEmitter context cleanup.
 * @module api_test.events.watcher
 * @memberof module:api_test
 */
/**
 * Test API file using chokidar (real third-party file watcher with EventEmitter).
 * Creates file watchers within slothlet API context to test cleanup.
 */

import chokidar from "chokidar";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Directory the watcher observes: this fixture's own folder — small, always present, and never
 * written to during the tests. Watching a path under `os.tmpdir()` made chokidar watch the whole
 * system temp directory (a non-existent target is watched through its parent), so the cost of every
 * watcher scaled with however many entries the machine's temp directory held.
 * @type {string}
 */
const WATCH_PATH = dirname(fileURLToPath(import.meta.url));

let watcher = null;

/**
 * Helper function to get listener count
 * @private
 */
function ____getListenerCount() {
	if (!watcher) return 0;

	return (
		watcher.listenerCount("add") +
		watcher.listenerCount("change") +
		watcher.listenerCount("unlink") +
		watcher.listenerCount("error") +
		watcher.listenerCount("ready")
	);
}

/**
 * File watcher API using chokidar
 */
export default {
	/**
	 * Initialize file watcher with event listeners
	 */
	init() {
		// Re-initialising replaces the watcher, so release the previous one's file-system handles.
		// Slothlet's shutdown strips listeners from tracked emitters; closing the watcher is the
		// owner's job, and a stale open watcher keeps doing file-system work for the rest of the run.
		if (watcher) watcher.close().catch(() => {});

		const watchPath = WATCH_PATH;

		watcher = chokidar.watch(watchPath, {
			persistent: false,
			ignoreInitial: true,
			awaitWriteFinish: false
		});

		// Add typical chokidar event listeners
		watcher.on("add", () => {});
		watcher.on("change", () => {});
		watcher.on("unlink", () => {});
		watcher.on("error", () => {});
		watcher.on("ready", () => {});

		return {
			created: true,
			watchPath,
			listenerCount: this.getListenerCount()
		};
	},

	/**
	 * Get current listener count
	 */
	getListenerCount() {
		if (!watcher) return 0;

		return (
			watcher.listenerCount("add") +
			watcher.listenerCount("change") +
			watcher.listenerCount("unlink") +
			watcher.listenerCount("error") +
			watcher.listenerCount("ready")
		);
	},

	/**
	 * Get the watcher instance for external verification
	 */
	getInstance() {
		return watcher;
	},

	/**
	 * Manually close the watcher (for testing)
	 */
	async close() {
		if (watcher) {
			await watcher.close();
		}
	}
};
