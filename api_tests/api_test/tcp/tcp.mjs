/**
 * @fileoverview TCP server API module for testing automatic EventEmitter context propagation. Internal file (not exported in package.json).
 * @module api_test.tcp
 * @memberof module:api_test
 */

import net from "node:net";
import { self, context, reference } from "@cldmv/slothlet/runtime";

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
		 * Creates a test TCP server that uses EventEmitter callbacks to verify context preservation.
		 * @function createTestServer
		 * @public
		 * @param {number} [port=0] - Port to listen on (0 for random port)
		 * @returns {Promise<object>} Server instance and port information
		 * @example
		 * const serverInfo = await api.tcp.createTestServer();
		 * console.log('Server listening on port:', serverInfo.port);
		 */
		async createTestServer(port = 0) {
			return new Promise((resolve, reject) => {
				// Create server - should be automatically wrapped when returned
				const server = net.createServer();

				const contextTests = [];

				// Test 1: Server connection handler - should preserve context automatically
				server.on("connection", (socket) => {
					console.log("  🔌 TCP Connection established");
					const socketOnMethod = socket.on;
					console.log("    socket.on type:", typeof socketOnMethod);
					console.log("    socket.on is function:", typeof socketOnMethod === "function");

					// Check if socket is wrapped properly
					console.log("  🔍 DEBUG - Socket inspection:");
					console.log("    Socket type:", typeof socket);
					console.log("    Socket constructor:", socket.constructor.name);
					console.log('    Socket has "on" method:', typeof socket.on === "function");
					console.log('    Socket has "emit" method:', typeof socket.emit === "function");
					console.log(
						"    Socket is proxied:",
						socket.toString().includes("Proxy") || Object.getOwnPropertyDescriptor(socket, "constructor") !== undefined
					);

					// Check context availability in connection handler - immediate access
					const immediateContext = context;
					const immediateUser = context?.user;
					const selfKeys = Object.keys(self);

					console.log("  🔍 DEBUG - Connection handler context access:");
					console.log("    Immediate context:", immediateContext);
					console.log("    Immediate user:", immediateUser);
					console.log("    Self keys count:", selfKeys.length);

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

					// Test 2: Socket data handler - nested EventEmitter callback
					socket.on("data", (_) => {
						console.log("  📥 Data received on socket");

						// Check context availability in data handler - immediate access
						const immediateContextData = context;
						const immediateContextUser = context?.user;
						const selfKeysData = Object.keys(self);

						console.log("  🔍 DEBUG - Data handler context access:");
						console.log("    Immediate context:", immediateContextData);
						console.log("    Immediate user:", immediateContextUser);
						console.log("    Self keys count:", selfKeysData.length);

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
						console.log("  📊 Context in data handler:", {
							selfKeys: dataTest.selfKeys.length,
							contextUser: immediateContextUser,
							testContextUser: dataTest.contextUser
						});

						// Test 3: Try to access other API modules from within the socket handler
						let apiAccessTest = null;
						try {
							if (self.math && typeof self.math.add === "function") {
								const mathResult = self.math.add(10, 15);
								apiAccessTest = {
									success: true,
									result: mathResult,
									error: null
								};
								console.log("  🧮 API call from socket handler: 10 + 15 =", mathResult);
							} else {
								apiAccessTest = {
									success: false,
									result: null,
									error: "self.math not available"
								};
							}
						} catch (error) {
							apiAccessTest = {
								success: false,
								result: null,
								error: error.message
							};
							console.log("  ❌ API call failed:", error.message);
						}

						// Send test results back to client
						const response = {
							message: "Context test completed",
							tests: contextTests,
							apiAccess: apiAccessTest,
							serverContext: {
								user: context?.user,
								session: context?.session
							}
						};

						socket.write(JSON.stringify(response) + "\n");
						socket.end();
					});

					socket.on("error", (error) => {
						console.log("  ❌ Socket error:", error.message);
					});
				});

				server.on("error", (error) => {
					console.log("  ❌ Server error:", error.message);
					reject(error);
				});

				server.listen(port, "localhost", () => {
					const actualPort = server.address().port;
					console.log(`  🌐 TCP Server listening on port ${actualPort}`);

					resolve({
						server,
						port: actualPort,
						close: () => {
							return new Promise((resolveClose) => {
								server.close(() => {
									console.log("  🛑 TCP Server closed");
									resolveClose();
								});
							});
						}
					});
				});
			});
		},

		/**
		 * Tests context availability within the TCP module itself.
		 * @function testContext
		 * @public
		 * @returns {object} Context information from within the TCP API module
		 */
		testContext() {
			// More detailed self analysis
			const selfKeys = Object.keys(self);
			const selfHasContent = selfKeys.length > 1; // More than just '_impl'

			return {
				selfAvailable: selfHasContent,
				selfKeys: selfKeys,
				selfType: typeof self,
				contextAvailable: context?.user === "test-user",
				contextType: typeof context,
				contextData: context,
				contextUser: context?.user,
				referenceType: typeof reference,
				timestamp: new Date().toISOString()
			};
		}
	};
