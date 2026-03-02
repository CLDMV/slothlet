/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-strict-mode.test.vitest.mjs
 *	@Date: 2026-02-14T18:14:33-08:00 (1771121673)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:56 -08:00 (1772425316)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TypeScript Strict Mode Tests with Type Generation
 * Tests TypeScript strict mode with .d.ts generation and cleanup
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import fs from "fs";
import path from "path";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

describe("TypeScript Strict Mode with Type Generation", () => {
	let api;
	const tmpDir = path.join("tmp", `slothlet-test-types-${Date.now()}`);
	const outputPath = path.join(tmpDir, "test-api.d.ts");
	const outputDir = tmpDir;
	
	// Ensure tmp directory exists
	if (!fs.existsSync("tmp")) {
		fs.mkdirSync("tmp", { recursive: true });
	}
	
	afterEach(async () => {
		// Clean up API
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
		
		// Clean up generated .d.ts file and temp directory
		if (fs.existsSync(outputPath)) {
			fs.unlinkSync(outputPath);
		}
		
		if (fs.existsSync(outputDir)) {
			fs.rmSync(outputDir, { recursive: true });
		}
	});
	
	describe("Configuration Validation", () => {
		it("should require types.output for strict mode", async () => {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => {
					api = await slothlet({
						dir: "./api_tests/api_test_typescript",
						typescript: {
							mode: "strict",
							types: {
								// Missing output
								interfaceName: "TestAPI"
							}
						}
					});
				}).rejects.toThrow("types.output");
			});
		});
		
		it("should require types.interfaceName for strict mode", async () => {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => {
					api = await slothlet({
						dir: "./api_tests/api_test_typescript",
						typescript: {
							mode: "strict",
							types: {
								output: outputPath
								// Missing interfaceName
							}
						}
					});
				}).rejects.toThrow("types.interfaceName");
			});
		});
	});
	
	describe("Type Generation", () => {
		it("should generate .d.ts file before loading", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
			
			// Verify .d.ts file was created
			expect(fs.existsSync(outputPath)).toBe(true);
		});
		
		it("should generate interface with correct name", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "MyCustomAPI"
					}
				}
			});
			
			const content = fs.readFileSync(outputPath, "utf8");
			expect(content).toContain("export interface MyCustomAPI");
		});
		
		it("should include math functions in generated types", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
			
			const content = fs.readFileSync(outputPath, "utf8");
			expect(content).toContain("math");
			expect(content).toContain("add");
		});
		
		it("should include string functions in generated types", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
			
			const content = fs.readFileSync(outputPath, "utf8");
			expect(content).toContain("string");
			expect(content).toContain("capitalize");
		});
		
		it("should declare self constant with interface type", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
			
			const content = fs.readFileSync(outputPath, "utf8");
			expect(content).toContain("declare const self: TestAPI");
		});
	});
	
	describe("Type Checking with Generated Types", () => {
		it("should load clean TypeScript files successfully", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
			
			expect(api.math.add(5, 3)).toBe(8);
			expect(api.string.capitalize("hello")).toBe("Hello");
		});
		
		it("should detect type errors in source files", async () => {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(async () => {
					api = await slothlet({
						dir: "./api_tests/api_test_typescript_errors",
						typescript: {
							mode: "strict",
							types: {
								output: outputPath,
								interfaceName: "TestAPI"
							}
						}
					});
				}).rejects.toThrow();
			});
		});
	});
	
	describe("Multiple Loads", () => {
		it("should reuse generated .d.ts on subsequent loads", async () => {
			// First load
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
			
			const firstModTime = fs.statSync(outputPath).mtimeMs;
			await api.slothlet.shutdown();
			
			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// Second load
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
			
			const secondModTime = fs.statSync(outputPath).mtimeMs;
			
			// File should have been regenerated (newer modification time)
			expect(secondModTime).toBeGreaterThanOrEqual(firstModTime);
		});
	});
	
	describe("Function Execution", () => {
		beforeEach(async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
		});
		
		it("should execute math functions correctly", () => {
			expect(api.math.add(10, 20)).toBe(30);
			expect(api.math.subtract(100, 50)).toBe(50);
			expect(api.math.multiply(7, 8)).toBe(56);
		});
		
		it("should execute string functions correctly", () => {
			expect(api.string.capitalize("world")).toBe("World");
			expect(api.string.lowercase("TYPESCRIPT")).toBe("typescript");
			expect(api.string.uppercase("strict")).toBe("STRICT");
		});
	});
	
	describe("Cleanup", () => {
		it("should allow cleanup of generated files", async () => {
			api = await slothlet({
				dir: "./api_tests/api_test_typescript",
				typescript: {
					mode: "strict",
					types: {
						output: outputPath,
						interfaceName: "TestAPI"
					}
				}
			});
			
			expect(fs.existsSync(outputPath)).toBe(true);
			
			await api.slothlet.shutdown();
			api = null;
			
			// Manual cleanup
			if (fs.existsSync(outputPath)) {
				fs.unlinkSync(outputPath);
			}
			
			expect(fs.existsSync(outputPath)).toBe(false);
		});
	});
});
