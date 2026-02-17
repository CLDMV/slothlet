/**
 * Test API file using chokidar (real third-party file watcher with EventEmitter).
 * Creates file watchers within slothlet API context to test cleanup.
 */

import chokidar from "chokidar";
import { tmpdir } from "node:os";
import { join } from "node:path";

let watcher = null;

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
