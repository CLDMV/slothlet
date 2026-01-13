/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/processed/context/tcp-eventemitter-context.test.vitest.mjs
 *	@Date: 2026-01-17 06:30:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-12 06:50:30 -08:00 (1768229430)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Vitest tests for TCP EventEmitter context propagation via API module.
 * @module tcp-eventemitter-context.test.vitest
 *
 * @description
 * Tests EventEmitter context propagation in TCP server/socket callbacks:
 * - Context availability in TCP module methods
 * - Context preservation in server.on("connection") callbacks
 * - Context preservation in socket.on("data") callbacks
 * - Full API access from within EventEmitter callbacks
 */

import { describe, test, expect } from "vitest";
import slothlet from "../../../../index.mjs";
import net from "node:net";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({}))("TCP EventEmitter Context Propagation - $name", ({ config }) => {
	test("Context available in TCP module methods", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		// Verify TCP module exists
		expect(api.tcp).toBeDefined();
		expect(typeof api.tcp.testContext).toBe("function");

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.tcp.testContext();
		}

		// Test context availability
		const tcpContext = await api.tcp.testContext();

		expect(tcpContext.selfAvailable).toBe(true);
		expect(tcpContext.selfKeys.length).toBeGreaterThan(0);
		expect(tcpContext.contextAvailable).toBe(true);
		expect(tcpContext.contextUser).toBe("test-user");

		await api.shutdown();
	});

	test("Context preserved in server.on('connection') callback", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.tcp.createTestServer();
		}

		// Create TCP server
		const serverInfo = await api.tcp.createTestServer();
		expect(serverInfo.port).toBeGreaterThan(0);

		// Connect client to trigger connection callback
		await new Promise((resolve, reject) => {
			const client = net.connect(serverInfo.port, "localhost", () => {
				client.end();
			});

			client.on("end", resolve);
			client.on("error", reject);

			setTimeout(() => {
				client.destroy();
				reject(new Error("Client timeout"));
			}, 5000);
		});

		// Close server
		await serverInfo.close();

		// Check connection handler context
		const connectionTests = serverInfo.contextTests.filter((t) => t.event === "connection");

		expect(connectionTests.length).toBeGreaterThan(0);

		const connTest = connectionTests[0];
		expect(connTest.selfAvailable).toBe(true);
		expect(connTest.selfKeys.length).toBeGreaterThan(0);
		expect(connTest.contextAvailable).toBe(true);
		expect(connTest.contextUser).toBe("test-user");

		await api.shutdown();
	});

	test("Context preserved in socket.on('data') callback", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.tcp.createTestServer();
		}

		// Create TCP server
		const serverInfo = await api.tcp.createTestServer();

		// Connect client and send data to trigger data callback
		await new Promise((resolve, reject) => {
			const client = net.connect(serverInfo.port, "localhost", () => {
				client.write("Test message for EventEmitter context verification");
			});

			client.on("data", () => {
				client.end();
			});

			client.on("end", resolve);
			client.on("error", reject);

			setTimeout(() => {
				client.destroy();
				reject(new Error("Client timeout"));
			}, 5000);
		});

		// Close server
		await serverInfo.close();

		// Check data handler context
		const dataTests = serverInfo.contextTests.filter((t) => t.event === "data");

		expect(dataTests.length).toBeGreaterThan(0);

		const dataTest = dataTests[0];
		expect(dataTest.selfAvailable).toBe(true);
		expect(dataTest.selfKeys.length).toBeGreaterThan(0);
		expect(dataTest.contextAvailable).toBe(true);
		expect(dataTest.contextUser).toBe("test-user");

		await api.shutdown();
	});

	test("API methods callable from EventEmitter callbacks", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.tcp.createTestServer();
		}

		// Create TCP server
		const serverInfo = await api.tcp.createTestServer();

		// Connect client to trigger callbacks
		await new Promise((resolve, reject) => {
			const client = net.connect(serverInfo.port, "localhost", () => {
				client.write("Test API access");
			});

			client.on("data", () => {
				client.end();
			});

			client.on("end", resolve);
			client.on("error", reject);

			setTimeout(() => {
				client.destroy();
				reject(new Error("Client timeout"));
			}, 5000);
		});

		// Close server
		await serverInfo.close();

		// Verify API method calls from EventEmitter callbacks
		const allTests = serverInfo.contextTests;

		// All callbacks should have been able to access self (API)
		for (const test of allTests) {
			expect(test.selfAvailable).toBe(true);
			expect(test.selfKeys.length).toBeGreaterThan(0);
		}

		await api.shutdown();
	});

	test("Full EventEmitter context propagation integration", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { user: "test-user", session: "tcp-test-session" }
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.tcp.createTestServer();
		}

		// Create TCP server
		const serverInfo = await api.tcp.createTestServer();

		// Connect client and send data
		await new Promise((resolve, reject) => {
			const client = net.connect(serverInfo.port, "localhost", () => {
				client.write("Full integration test");
			});

			client.on("data", () => {
				client.end();
			});

			client.on("end", resolve);
			client.on("error", reject);

			setTimeout(() => {
				client.destroy();
				reject(new Error("Client timeout"));
			}, 5000);
		});

		// Close server
		await serverInfo.close();

		// Verify both connection and data handlers preserved context
		const connectionTests = serverInfo.contextTests.filter((t) => t.event === "connection");
		const dataTests = serverInfo.contextTests.filter((t) => t.event === "data");

		// Connection handler validation
		expect(connectionTests.length).toBeGreaterThan(0);
		const connTest = connectionTests[0];
		expect(connTest.selfAvailable).toBe(true);
		expect(connTest.contextAvailable).toBe(true);
		expect(connTest.contextUser).toBe("test-user");

		// Data handler validation
		expect(dataTests.length).toBeGreaterThan(0);
		const dataTest = dataTests[0];
		expect(dataTest.selfAvailable).toBe(true);
		expect(dataTest.contextAvailable).toBe(true);
		expect(dataTest.contextUser).toBe("test-user");

		await api.shutdown();
	});
});
