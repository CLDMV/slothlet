/**
 * @fileoverview Test automatic EventEmitter context propagation across all matrix configurations
 *
 * @description
 * Tests that context is preserved WITHOUT requiring consumer changes in EventEmitter callbacks.
 * Verifies that slothlet's AsyncLocalStorage-based context propagation works automatically
 * for TCP server events, including connection and data handlers.
 *
 * Original test: tests/test-auto-context-propagation.mjs
 * New test count: 20 tests (1 test × 20 matrix configs)
 *
 * @module tests/vitests/auto-context-propagation.test.vitest
 */

import { describe, it, expect } from "vitest";
import net from "node:net";
import { getMatrixConfigs, TEST_DIRS } from "./vitest-helper.mjs";

describe("Auto Context Propagation", () => {
	describe.each(getMatrixConfigs({}))("Config: '$name'", ({ name, config }) => {
		it("should preserve context automatically in EventEmitter callbacks", async () => {
			// Import slothlet and create an API instance with context
			const { default: slothlet } = await import("@cldmv/slothlet");
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				context: { user: "test-user", session: "auto-test-session" },
				...config
			});

			// Verify API setup
			expect(api).toBeTruthy();
			expect(api.__ctx).toBeTruthy();

			// Skip test if TCP module not available (e.g., in MIXED configurations with limited depth)
			if (!api.tcp) {
				console.log(`Skipping ${name}: TCP module not available`);
				return;
			}

			// Test API method call to establish context baseline (await for lazy modes)
			const mathResult = await api.math.add(1, 2);
			expect(mathResult).toBe(3);

			// Test direct context access through API module (await for lazy modes)
			const contextTest = await api.tcp.testContext();
			expect(contextTest.contextAvailable, `${name}: Direct context access should work`).toBe(true);
			expect(contextTest.contextUser, `${name}: Direct context should have correct user`).toBe("test-user");

			// Use the API module to create and test TCP server for EventEmitter context propagation
			const serverResult = await api.tcp.createTestServer();
			expect(serverResult).toBeTruthy();
			expect(serverResult.port).toBeTruthy();
			expect(typeof serverResult.close).toBe("function");

			let responseData = null;

			// Test by connecting as a client and verify context propagation in EventEmitter callbacks
			const testPromise = new Promise((resolve, reject) => {
				const client = net.connect(serverResult.port, "localhost", () => {
					client.write("Test message for context verification");
				});

				client.on("data", (data) => {
					try {
						responseData = JSON.parse(data.toString());
						client.end();
					} catch (e) {
						reject(new Error(`Failed to parse response as JSON: ${e.message}`));
					}
				});

				client.on("end", () => {
					resolve();
				});

				client.on("error", reject);

				// Add timeout to prevent hanging tests
				setTimeout(() => {
					client.destroy();
					reject(new Error("Test timeout after 10 seconds"));
				}, 10000);
			});

			await testPromise;

			// Close the server
			await serverResult.close();

			// Verify response data exists
			expect(responseData, "Server should return test response data").toBeTruthy();

			// Analyze the response data to verify context preservation in EventEmitter callbacks
			const connectionTest = responseData.tests?.find((t) => t.event === "connection");
			const dataTest = responseData.tests?.find((t) => t.event === "data");

			expect(connectionTest, "Connection event test should be present").toBeTruthy();
			expect(dataTest, "Data event test should be present").toBeTruthy();

			// Verify connection handler context preservation (EventEmitter callback)
			expect(connectionTest.contextAvailable, `${name}: Connection handler should have context available`).toBe(true);
			expect(connectionTest.contextUser, `${name}: Connection handler should have correct context user`).toBe("test-user");

			// Verify data handler context preservation (nested EventEmitter callback)
			expect(dataTest.contextAvailable, `${name}: Data handler should have context available`).toBe(true);
			expect(dataTest.contextUser, `${name}: Data handler should have correct context user`).toBe("test-user");

			// Verify API access from handlers works (context enables API access)
			expect(responseData.apiAccess, "API access test should be present").toBeTruthy();
			expect(responseData.apiAccess.success, `${name}: API access from event handlers should work`).toBe(true);
		}, 15000); // 15 second timeout per test
	});
});
