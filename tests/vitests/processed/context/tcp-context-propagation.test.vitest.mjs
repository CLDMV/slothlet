/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/processed/context/tcp-context-propagation.test.vitest.mjs
 *	@Date: 2026-01-11 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-11 00:00:00 -08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test automatic EventEmitter context propagation using TCP API modules.
 * @module tcp-context-propagation.test.vitest
 *
 * @description
 * Tests that context is preserved in EventEmitter callbacks within API modules
 * WITHOUT requiring consumer changes. Verifies:
 * - Context availability in TCP module methods
 * - Context preservation in server.on("connection", callback)
 * - Context preservation in socket.on("data", callback)
 * - API access from within EventEmitter callbacks
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import net from "node:net";
import { TEST_MATRIX, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(TEST_MATRIX)("TCP Context Propagation - $name", ({ name: ___name, config }) => {
	let slothlet;
	let api = null;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	test("Context available in TCP module methods", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		// Verify TCP module exists
		expect(api.tcp).toBeDefined();
		expect(typeof api.tcp.testContext).toBe("function");

		// Test context availability (materialize first in lazy mode)
		const testContextFunc = api.tcp.testContext;
		if (config.mode === "lazy" && typeof testContextFunc === "function") {
			await testContextFunc();
		}
		const tcpContext = api.tcp.testContext();
		expect(tcpContext.selfAvailable).toBe(true);
		expect(tcpContext.selfKeys.length).toBeGreaterThan(0);
		expect(tcpContext.contextAvailable).toBe(true);
		expect(tcpContext.contextUser).toBe("test-user");
	});

	test("Context preserved in TCP EventEmitter callbacks", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		// Create TCP server via API module
		const serverInfo = await api.tcp.createTestServer();
		expect(serverInfo).toBeDefined();
		expect(serverInfo.port).toBeGreaterThan(0);
		expect(serverInfo.server).toBeDefined();

		try {
			// Connect as client and test context propagation
			const testResult = await new Promise((resolve, reject) => {
				const client = net.connect(serverInfo.port, "localhost", () => {
					client.write("Test message for context propagation");
				});

				client.on("data", (data) => {
					try {
						const response = JSON.parse(data.toString());
						resolve(response);
					} catch (error) {
						reject(error);
					}
				});

				client.on("error", (error) => {
					reject(error);
				});

				// Timeout after 5 seconds
				setTimeout(() => {
					client.destroy();
					reject(new Error("Client timeout"));
				}, 5000);
			});

			// Verify all context tests passed
			expect(testResult.tests).toBeDefined();
			expect(Array.isArray(testResult.tests)).toBe(true);
			expect(testResult.tests.length).toBeGreaterThan(0);

			// Check each EventEmitter callback preserved context
			for (const test of testResult.tests) {
				expect(test.selfAvailable).toBe(true);
				expect(test.selfKeys.length).toBeGreaterThan(0);
				expect(test.contextAvailable).toBe(true);
				expect(test.contextData?.user).toBe("test-user");
			}

			// Verify API access works from within callbacks
			expect(testResult.apiAccess.success).toBe(true);
			expect(testResult.apiAccess.result).toBeDefined();

			// Verify server context
			expect(testResult.serverContext.user).toBe("test-user");
			expect(testResult.serverContext.session).toBe("tcp-test-session");
		} finally {
			// Always close the server
			await serverInfo.close();
		}
	});

	test("Context propagation verified in connection handler", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		const serverInfo = await api.tcp.createTestServer();

		try {
			const testResult = await new Promise((resolve, reject) => {
				const client = net.connect(serverInfo.port, "localhost", () => {
					client.write("Connection test");
				});

				client.on("data", (data) => {
					try {
						const response = JSON.parse(data.toString());
						resolve(response);
					} catch (error) {
						reject(error);
					}
				});

				client.on("error", reject);

				setTimeout(() => {
					client.destroy();
					reject(new Error("Timeout"));
				}, 5000);
			});

			// Find connection event test
			const connectionTests = testResult.tests.filter((t) => t.event === "connection");
			expect(connectionTests.length).toBeGreaterThan(0);

			const connectionTest = connectionTests[0];
			expect(connectionTest.selfAvailable).toBe(true);
			expect(connectionTest.contextAvailable).toBe(true);
			expect(connectionTest.contextData?.user).toBe("test-user");
		} finally {
			await serverInfo.close();
		}
	});

	test("Context propagation verified in data handler", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		const serverInfo = await api.tcp.createTestServer();

		try {
			const testResult = await new Promise((resolve, reject) => {
				const client = net.connect(serverInfo.port, "localhost", () => {
					client.write("Data handler test");
				});

				client.on("data", (data) => {
					try {
						const response = JSON.parse(data.toString());
						resolve(response);
					} catch (error) {
						reject(error);
					}
				});

				client.on("error", reject);

				setTimeout(() => {
					client.destroy();
					reject(new Error("Timeout"));
				}, 5000);
			});

			// Find data event test
			const dataTests = testResult.tests.filter((t) => t.event === "data");
			expect(dataTests.length).toBeGreaterThan(0);

			const dataTest = dataTests[0];
			expect(dataTest.selfAvailable).toBe(true);
			expect(dataTest.contextAvailable).toBe(true);
			expect(dataTest.contextData?.user).toBe("test-user");
		} finally {
			await serverInfo.close();
		}
	});

	test("API method calls work from within EventEmitter callbacks", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		const serverInfo = await api.tcp.createTestServer();

		try {
			const testResult = await new Promise((resolve, reject) => {
				const client = net.connect(serverInfo.port, "localhost", () => {
					client.write("API access test");
				});

				client.on("data", (data) => {
					try {
						const response = JSON.parse(data.toString());
						resolve(response);
					} catch (error) {
						reject(error);
					}
				});

				client.on("error", reject);

				setTimeout(() => {
					client.destroy();
					reject(new Error("Timeout"));
				}, 5000);
			});

			// Verify API call succeeded
			expect(testResult.apiAccess).toBeDefined();
			expect(testResult.apiAccess.success).toBe(true);
			expect(testResult.apiAccess.result).toBeDefined();
		} finally {
			await serverInfo.close();
		}
	});
});
