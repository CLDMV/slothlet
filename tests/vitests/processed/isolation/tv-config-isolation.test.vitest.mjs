/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/processed/isolation/tv-config-isolation.test.vitest.mjs
 *	@Date: 2026-01-17 07:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-12 18:56:10 -08:00 (1768272970)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Vitest tests for TV config isolation between multiple slothlet instances.
 * @module tv-config-isolation.test.vitest
 *
 * @description
 * Tests that config state is properly isolated between different slothlet instances.
 * This prevents bugs where config is shared between instances when it should be isolated.
 *
 * Key scenarios:
 * - Different instance IDs for separate instances
 * - Config updates in one instance don't affect another
 * - Unique values remain unique to each instance
 * - Function calls return instance-specific values
 */

import { describe, test, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({}))("TV Config Isolation - $name", ({ config }) => {
	test("Different instance IDs for separate instances", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.getInstanceInfo();
			await api2.config.getInstanceInfo();
		}

		const instance1Info = await api1.config.getInstanceInfo();
		const instance2Info = await api2.config.getInstanceInfo();

		// Instance IDs should be different
		expect(instance1Info.instanceId).not.toBe(instance2Info.instanceId);

		await api1.shutdown();
		await api2.shutdown();
	});

	test("Config updates isolated between instances", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.update({});
			await api2.config.update({});
		}

		// Update config in instance 1
		await api1.config.update({
			manufacturer: "samsung",
			host: "192.168.1.200",
			port: 8080
		});

		// Update config in instance 2 with different values
		await api2.config.update({
			manufacturer: "sony",
			host: "192.168.1.300",
			port: 9090
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.get();
			await api2.config.get();
		}

		// Get updated configs
		const config1 = await api1.config.get();
		const config2 = await api2.config.get();

		// Configs should be different
		expect(config1.manufacturer).toBe("samsung");
		expect(config2.manufacturer).toBe("sony");
		expect(config1.host).toBe("192.168.1.200");
		expect(config2.host).toBe("192.168.1.300");
		expect(config1.port).toBe(8080);
		expect(config2.port).toBe(9090);

		await api1.shutdown();
		await api2.shutdown();
	});

	test("Unique values remain unique to each instance", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.update("", "");
			await api2.config.update("", "");
		}

		// Set unique values in each instance
		await api1.config.update("uniqueToInstance1", "value-only-in-1");
		await api2.config.update("uniqueToInstance2", "value-only-in-2");

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.get();
			await api2.config.get();
		}

		const finalConfig1 = await api1.config.get();
		const finalConfig2 = await api2.config.get();

		// Instance 1 should have uniqueToInstance1 but not uniqueToInstance2
		expect(finalConfig1.uniqueToInstance1).toBe("value-only-in-1");
		expect(finalConfig1.uniqueToInstance2).toBeUndefined();

		// Instance 2 should have uniqueToInstance2 but not uniqueToInstance1
		expect(finalConfig2.uniqueToInstance2).toBe("value-only-in-2");
		expect(finalConfig2.uniqueToInstance1).toBeUndefined();

		await api1.shutdown();
		await api2.shutdown();
	});

	test("Function calls return instance-specific values", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.update({ port: 8080 });
			await api2.config.update({ port: 9090 });
			await api1.config.getDefaultPort();
			await api2.config.getDefaultPort();
		}

		// Set different ports for each instance
		await api1.config.update({ port: 8080 });
		await api2.config.update({ port: 9090 });

		// Get default ports
		const port1 = await api1.config.getDefaultPort();
		const port2 = await api2.config.getDefaultPort();

		// Ports should reflect instance-specific config
		expect(port1).toBe(8080);
		expect(port2).toBe(9090);

		await api1.shutdown();
		await api2.shutdown();
	});

	test("Multiple updates maintain isolation", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.update({});
			await api2.config.update({});
		}

		// Multiple updates in instance 1
		await api1.config.update({ manufacturer: "samsung", host: "192.168.1.100" });
		await api1.config.update({ port: 8080 });
		await api1.config.update("testKey1", "testValue1");

		// Multiple updates in instance 2
		await api2.config.update({ manufacturer: "lg", host: "192.168.1.200" });
		await api2.config.update({ port: 9090 });
		await api2.config.update("testKey2", "testValue2");

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.get();
			await api2.config.get();
		}

		// Verify final states
		const final1 = await api1.config.get();
		const final2 = await api2.config.get();

		expect(final1.manufacturer).toBe("samsung");
		expect(final1.host).toBe("192.168.1.100");
		expect(final1.port).toBe(8080);
		expect(final1.testKey1).toBe("testValue1");
		expect(final1.testKey2).toBeUndefined();

		expect(final2.manufacturer).toBe("lg");
		expect(final2.host).toBe("192.168.1.200");
		expect(final2.port).toBe(9090);
		expect(final2.testKey2).toBe("testValue2");
		expect(final2.testKey1).toBeUndefined();

		await api1.shutdown();
		await api2.shutdown();
	});

	test("Cross-contamination prevention", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.update({});
			await api2.config.update({});
		}

		// Set comprehensive config in instance 1
		await api1.config.update({
			manufacturer: "samsung",
			host: "192.168.1.100",
			port: 8080,
			testValue1: "only-in-instance-1",
			nested: { value: "nested-1" }
		});

		// Set comprehensive config in instance 2
		await api2.config.update({
			manufacturer: "sony",
			host: "192.168.1.200",
			port: 9090,
			testValue2: "only-in-instance-2",
			nested: { value: "nested-2" }
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api1.config.get();
			await api2.config.get();
		}

		const config1 = await api1.config.get();
		const config2 = await api2.config.get();

		// Verify no cross-contamination
		expect(config1.testValue1).toBe("only-in-instance-1");
		expect(config1.testValue2).toBeUndefined();
		expect(config1.nested.value).toBe("nested-1");

		expect(config2.testValue2).toBe("only-in-instance-2");
		expect(config2.testValue1).toBeUndefined();
		expect(config2.nested.value).toBe("nested-2");

		await api1.shutdown();
		await api2.shutdown();
	});
});
