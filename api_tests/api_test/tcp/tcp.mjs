/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/tcp/tcp.mjs
 *	@Date: 2025-10-21 13:32:36 -07:00 (1761078756)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-08 08:44:44 -08:00 (1767890684)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TCP server API module for testing automatic EventEmitter context propagation. Internal file (not exported in package.json).
 * @module api_test.tcp
 * @memberof module:api_test
 */

import net from "node:net";
import { self, context } from "@cldmv/slothlet/runtime";

// Helper to check if debug mode is enabled
const isDebugEnabled = () => {
	try {
		return self?.__ctx?.config?.debug === true;
	} catch {
		return false;
	}
};

/**
 * TCP server API object for testing automatic EventEmitter context propagation.
 * This module tests slothlet's ability to preserve AsyncLocalStorage context
 * across EventEmitter callbacks without requiring consumer changes.
 * Accessed as `api.tcp` in the slothlet API.
 * @alias module:api_test.tcp
 * @public
 */
export const tcp =
	/** @lends tcp */
	{
		/**
		 * Test context availability in the tcp module.
		 * @function testContext
		 * @returns {object} Context test results
		 */
		testContext() {
			const selfKeys = Object.keys(self);
			const immediateContext = context;
			const immediateUser = context?.user;

			return {
				selfAvailable: selfKeys.length > 1,
				selfKeys: selfKeys,
				contextAvailable: immediateUser === "test-user",
				contextData: immediateContext,
				contextUser: immediateUser,
				timestamp: new Date().toISOString()
			};
		},

		/**
		 * Create a test TCP server that tests context propagation in EventEmitter callbacks.
		 * @function createTestServer
		 * @param {number} [port=0] - Port to listen on (0 for random)
		 * @returns {Promise<{port: number, server: NetServer}>} Server instance and port
		 */
		async createTestServer(port = 0) {
			const server = net.createServer();
			const contextTests = []; // Array to collect context test results

			if (isDebugEnabled()) {
				console.log("  🔍 DEBUG - Server inspection:");
				console.log("    Server type:", typeof server);
				console.log("    Server constructor:", server.constructor.name);
				console.log('    Server has "on" method:', typeof server.on === "function");
				console.log('    Server has "emit" method:', typeof server.emit === "function");
			}

			// CRITICAL: Set up connection handler BEFORE starting server
			// The key insight: this callback will use the original server.on method
			// Server only gets wrapped when the Promise resolves with the {server} object
			server.on("connection", (socket) => {
				if (isDebugEnabled()) {
					console.log("  🔌 TCP Connection established");
				}

				// Test context access immediately in the connection handler
				const immediateContext = context;
				const immediateUser = context?.user;
				const selfKeys = Object.keys(self);

				if (isDebugEnabled()) {
					console.log("  🔍 DEBUG - Connection handler context access:");
					console.log("    Immediate context:", immediateContext);
					console.log("    Immediate user:", immediateUser);
					console.log("    Self keys count:", selfKeys.length);
				}

				const connectionTest = {
					event: "connection",
					selfAvailable: selfKeys.length > 1,
					selfKeys: selfKeys,
					contextAvailable: immediateUser === "test-user",
					contextData: immediateContext,
					contextUser: immediateUser,
					timestamp: new Date().toISOString()
				};

				contextTests.push(connectionTest);

				if (isDebugEnabled()) {
					console.log("  📊 Context in connection handler:", {
						selfKeys: connectionTest.selfKeys.length,
						contextUser: immediateUser,
						testContextUser: connectionTest.contextUser
					});

					// Debug: Check if socket is wrapped before calling socket.on()
					console.log("  🔍 DEBUG - Before socket.on('data') call:");
					console.log("    Socket type:", typeof socket);
					console.log("    Socket constructor:", socket.constructor.name);
					console.log("    Socket 'on' method type:", typeof socket.on);
					console.log("    Socket toString contains Proxy:", socket.toString().includes("Proxy"));
					console.log("    Socket proxy detection:", Object.getOwnPropertyDescriptor(socket, "constructor"));
				}

				// Test socket data handler - this should now preserve context
				socket.on("data", (_) => {
					if (isDebugEnabled()) {
						console.log("  📥 Data received on socket");
					}

					// Check context availability in data handler
					const immediateContextData = context;
					const immediateContextUser = context?.user;
					const selfKeysData = Object.keys(self);

					if (isDebugEnabled()) {
						console.log("  🔍 DEBUG - Data handler context access:");
						console.log("    Immediate context:", immediateContextData);
						console.log("    Immediate user:", immediateContextUser);
						console.log("    Self keys count:", selfKeysData.length);
					}

					const dataTest = {
						event: "data",
						selfAvailable: selfKeysData.length > 1,
						selfKeys: selfKeysData,
						contextAvailable: immediateContextUser === "test-user",
						contextData: immediateContextData,
						contextUser: immediateContextUser,
						timestamp: new Date().toISOString()
					};

					contextTests.push(dataTest);
					if (isDebugEnabled()) {
						console.log("  📊 Context in data handler:", {
							selfKeys: dataTest.selfKeys.length,
							contextUser: immediateContextUser,
							testContextUser: dataTest.contextUser
						});
					}

					// Test API access from within the socket handler
					let apiAccess = { success: false, error: "Not attempted" };
					try {
						if (self.math && typeof self.math.add === "function") {
							const result = self.math.add(10, 20);
							apiAccess = { success: true, result: result };
						} else {
							apiAccess = { success: false, error: "Math API not available" };
						}
					} catch (error) {
						apiAccess = { success: false, error: error.message };
					}

					// Send JSON response with all test results
					const response = {
						tests: contextTests,
						apiAccess: apiAccess,
						serverContext: immediateContextData,
						timestamp: new Date().toISOString()
					};

					socket.write(JSON.stringify(response) + "\n");
					socket.end();
				});
			});

			// Start listening and return server info
			return new Promise((resolve, reject) => {
				server.listen(port, (err) => {
					if (err) {
						if (isDebugEnabled()) {
							console.log("  ❌ Server failed to start:", err.message);
						}
						reject(err);
					} else {
						const actualPort = server.address()?.port || port;
						if (isDebugEnabled()) {
							console.log(`  🌐 TCP Server listening on port ${actualPort}`);
						}

						// Return object containing server - this will trigger immediate wrapping
						resolve({
							port: actualPort,
							server: server,
							contextTests: contextTests,
							close: () => {
								return new Promise((resolveClose) => {
									server.close(() => resolveClose());
								});
							}
						});
					}
				});
			});
		}
	};

/**
 * @typedef {import('node:net').Server} NetServer
 */
