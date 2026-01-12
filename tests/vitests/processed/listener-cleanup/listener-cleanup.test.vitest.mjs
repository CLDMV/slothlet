/**
 * @fileoverview Listener cleanup validation across all slothlet configurations.
 *
 * @description
 * Migrates tests from tests/test-listener-cleanup.mjs to vitest with matrix coverage.
 * Verifies EventEmitter listeners and registered hooks are cleaned up on shutdown.
 *
 * @module tests/vitests/processed/listener-cleanup/listener-cleanup.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../vitest-helper.mjs";

/**
 * Create a slothlet instance for testing.
 * @param {object} baseConfig - Base configuration from the matrix.
 * @returns {Promise<object>} Initialized slothlet API instance.
 */
async function createApi(baseConfig) {
	return slothlet({ ...baseConfig, dir: TEST_DIRS.API_TEST });
}

/**
 * Count listeners across the test emitters.
 * @param {EventEmitter[]} emitters - Event emitters under test.
 * @returns {number} Total listener count for all watched events.
 */
function countListeners(emitters) {
	return (
		emitters[0].listenerCount("test") +
		emitters[0].listenerCount("custom") +
		emitters[1].listenerCount("data") +
		emitters[1].listenerCount("close") +
		emitters[2].listenerCount("priority")
	);
}

describe.each(getMatrixConfigs({}))("Listener Cleanup - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("removes EventEmitter listeners on shutdown", async () => {
		api = await createApi(config);

		const emitter1 = new EventEmitter();
		const emitter2 = new EventEmitter();
		const emitter3 = new EventEmitter();
		let callCount = 0;

		const handler1 = () => {
			callCount++;
		};
		const handler2 = () => {
			callCount++;
		};
		const onceHandler = () => {
			callCount++;
		};

		emitter1.on("test", handler1);
		emitter1.addListener("custom", handler2);
		emitter2.on("data", handler2);
		emitter2.once("close", onceHandler);
		emitter3.prependListener("priority", handler1);

		if (config.hooks) {
			api.hooks.on("before", () => undefined, { pattern: "**" });
			api.hooks.on("after", ({ result }) => result, { pattern: "**" });
			api.hooks.on("always", () => undefined, { pattern: "**" });
		}

		// Trigger listeners to ensure they are active.
		emitter1.emit("test");
		emitter1.emit("custom", "test-data");
		emitter2.emit("data", "important-data");
		emitter2.emit("close");
		emitter3.emit("priority");

		expect(callCount).toBe(5);
		expect(countListeners([emitter1, emitter2, emitter3])).toBeGreaterThan(0);

		await api.shutdown();
		api = null;

		expect(countListeners([emitter1, emitter2, emitter3])).toBe(0);
	});
});
