/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/events/watcher.mjs
 *	@Date: 2026-02-17T06:50:24-08:00 (1771339824)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:09 -08:00 (1772425269)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Test API file using chokidar (real third-party file watcher with EventEmitter).
 * Creates file watchers within slothlet API context to test cleanup.
 */

import chokidar from "chokidar";
import { tmpdir } from "node:os";
import { join } from "node:path";

let watcher = null;

/**
 * Helper function to get listener count
 * @private
 */
function getListenerCount() {
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
		// Watch a temp directory (won't actually monitor anything)
		const watchPath = join(tmpdir(), "slothlet-test-watch-*");

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
