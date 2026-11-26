/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/boundary-patch-layer-registry.test.vitest.mjs
 *	@Date: 2026-11-25T02:29:47-08:00 (1795602587)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:42:56-08:00 (1795603376)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The shared registry of boundary-patch layers, as two copies of slothlet in one realm see it.
 *
 * @description
 * Every copy of slothlet keeps its patch layers in one registry on the global object, under
 * `Symbol.for("slothlet.boundaryPatch.layers")`. A registry an earlier copy left replaceable is fixed in place the
 * first time a copy reads it: the same map, no longer writable or configurable. A copy reads another copy's layer from
 * the registry once and keeps what it read, so a layer put in its place later is not taken for it.
 *
 * Nothing else in this file loads slothlet, so the registry does not exist yet when the first case runs.
 * @module tests/vitests/suites/context/boundary-patch-layer-registry
 */

import { pathToFileURL } from "node:url";
import { describe, it, expect } from "vitest";
import { internalLibPath } from "../../setup/internal-resolve.mjs";

const KEY = Symbol.for("slothlet.boundaryPatch.layers");
const FILE = pathToFileURL(internalLibPath("helpers/boundary-patch-layers.mjs")).href;

describe("Context > boundary patch layers > the shared registry", () => {
	it("fixes a registry an earlier copy left replaceable in place, keeping the same map", async () => {
		expect(Object.getOwnPropertyDescriptor(globalThis, KEY)).toBe(undefined);
		const registry = new WeakMap();
		Object.defineProperty(globalThis, KEY, { value: registry, writable: true, configurable: true });
		const layers = await import(`${FILE}?registry=first`);
		expect(layers.isActiveLayer(() => {})).toBe(false);
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, KEY);
		expect(descriptor.value).toBe(registry);
		expect(descriptor.writable).toBe(false);
		expect(descriptor.configurable).toBe(false);
	});

	it("reads another copy's layer once, and keeps reading what it read", async () => {
		const mine = await import(`${FILE}?registry=mine`);
		const other = await import(`${FILE}?registry=other`);
		const wrapper = () => {};
		const layer = other.openLayer(() => {});
		other.markLayer(wrapper, layer);
		expect(mine.isActiveLayer(wrapper)).toBe(true);
		// Read again: answered from what this copy read the first time.
		expect(mine.isActiveLayer(wrapper)).toBe(true);
		other.closeLayer(layer);
		expect(mine.isActiveLayer(wrapper)).toBe(false);
		// Something that is no layer in the registry.
		expect(mine.isActiveLayer(5)).toBe(false);
		expect(mine.isActiveLayer({})).toBe(false);
	});
});
