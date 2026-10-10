/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-proxy-default.test.vitest.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T00:00:00-07:00 (1791529200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A Proxy default composed with named exports keeps its traps and is never written to.
 *
 * @description
 * `import lg, { extra } from "./lg.mjs"` leaves `lg` untouched; the api node offers the Proxy's
 * behavior and the named exports side by side. Fixture `api_smart_flatten_proxy_default`:
 * ```
 * ro.mjs   default: read-only Proxy over ["a", "b"]   + extra()        → api.ro[0] = "a", api.ro.extra()
 * rec.mjs  default: Proxy recording writes to its target + writeCount(), targetKeys()
 * fz.mjs   default: Proxy over a frozen target          + extra()        → api.fz.base(), api.fz.extra()
 * ```
 *
 * @module tests/vitests/suites/smart-flattening/smart-flattening-proxy-default
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_proxy_default");

describe.each(getMatrixConfigs({}))("Proxy default with named exports > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("composes a read-only Proxy default without writing to it", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.ro.extra()).toBe("ro.extra");
		expect(await api.ro[0]).toBe("a");
		expect(await api.ro[1]).toBe("b");
	});

	it("leaves the module's own Proxy default and its target untouched, and keeps its traps", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.rec.base()).toBe("rec.base");
		expect(await api.rec.virtual).toBe("rec.virtual");
		expect(await api.rec.writeCount()).toBe(0);
		expect(await api.rec.targetKeys()).toBe("base");
	});

	it("composes a Proxy default over a frozen target, which cannot gain members", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.fz.base()).toBe("fz.base");
		expect(await api.fz.extra()).toBe("fz.extra");
		expect(Object.keys(api.fz).sort()).toEqual(["base", "extra"]);
	});
});

describe("Flatten#cloneDefault layers a Proxy default instead of writing to it", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * The instance's Flatten processor.
	 * @returns {Promise<object>} Flatten.
	 */
	const flatten = async () => {
		api = await slothlet({ mode: "eager", base: BASE });
		return resolveWrapper(api.ro).slothlet.processors.flatten;
	};

	it("holds added, redefined and deleted members in the layer and never touches the Proxy", async () => {
		const writes = [];
		const target = { a: 1, b: 2 };
		const proxy = new Proxy(target, {
			set: (t, key, value) => (writes.push(`set:${String(key)}`), Reflect.set(t, key, value)),
			defineProperty: (t, key, d) => (writes.push(`define:${String(key)}`), Reflect.defineProperty(t, key, d)),
			deleteProperty: (t, key) => (writes.push(`delete:${String(key)}`), Reflect.deleteProperty(t, key))
		});
		const layer = (await flatten()).cloneDefault(proxy);
		layer.extra = "x";
		Object.defineProperty(layer, "hidden", { value: "h", enumerable: false });
		delete layer.a;
		expect(layer.extra).toBe("x");
		expect(layer.hidden).toBe("h");
		expect("a" in layer).toBe(false);
		expect(layer.a).toBeUndefined();
		expect(layer.b).toBe(2);
		expect(Object.keys(layer)).toEqual(["b", "extra"]);
		layer.a = "again";
		expect(layer.a).toBe("again");
		expect(writes).toEqual([]);
		expect(target).toEqual({ a: 1, b: 2 });
	});

	it("keeps an array Proxy an array, with its own length and indices", async () => {
		const proxy = new Proxy(["a", "b"], {});
		const layer = (await flatten()).cloneDefault(proxy);
		layer.extra = "x";
		expect(Array.isArray(layer)).toBe(true);
		expect(layer.length).toBe(2);
		expect(layer[1]).toBe("b");
		expect(Object.keys(layer)).toEqual(["0", "1", "extra"]);
		expect(Object.getOwnPropertyDescriptor(layer, "length")).toMatchObject({ value: 2, configurable: false });
	});

	it("reports the Proxy's prototype", async () => {
		class Store {}
		const layer = (await flatten()).cloneDefault(new Proxy(new Store(), {}));
		expect(layer instanceof Store).toBe(true);
	});
});
