/**
 * @fileoverview Hooks, routines and the loader's `hidden` globs read `**` as permission rules do: zero or more
 * segments, so `x.**` names `x` itself as well as everything below it.
 *
 * Expected values come from the rule: a pattern ending in `.**` matches the path before it.
 * @module tests/vitests/suites/helpers/pattern-globstar-everywhere
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_globstar_zero");

describe.each([
	["eager", "async"],
	["eager", "live"],
	["lazy", "async"],
	["lazy", "live"]
])("a pattern ending in .** names the path before it too (%s, %s)", (mode, runtime) => {
	beforeEach(() => {
		globalThis.__slothletGlobstarLog = [];
	});

	it("a hook on svc.** fires for svc() and for svc.start()", async () => {
		const api = await slothlet({ dir: BASE, mode, runtime, silent: true, hook: true });
		try {
			const seen = [];
			api.slothlet.hook.on("svc.**:before", ({ path: apiPath }) => {
				seen.push(apiPath);
			});
			await api.svc();
			await api.svc.start();
			await api.other.ping();
			expect(seen).toEqual(["svc", "svc.start"]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("a hook on **.svc fires for svc() and not for svc.start()", async () => {
		const api = await slothlet({ dir: BASE, mode, runtime, silent: true, hook: true });
		try {
			const seen = [];
			api.slothlet.hook.on("**.svc:before", ({ path: apiPath }) => {
				seen.push(apiPath);
			});
			await api.svc();
			await api.svc.start();
			expect(seen).toEqual(["svc"]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("the default hook pattern svc.** covers svc()", async () => {
		const api = await slothlet({ dir: BASE, mode, runtime, silent: true, hook: "svc.**" });
		try {
			const seen = [];
			api.slothlet.hook.on("**:before", ({ path: apiPath }) => {
				seen.push(apiPath);
			});
			await api.svc();
			await api.svc.start();
			await api.other.ping();
			expect(seen).toEqual(["svc", "svc.start"]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("a root-anchored routine ^work.job.** runs work.job and work.job.step", async () => {
		const api = await slothlet({ dir: BASE, mode, runtime, silent: true, routines: [{ name: "^work.job.**", mode: "manual" }] });
		try {
			await api["^work.job.**"]();
			expect([...globalThis.__slothletGlobstarLog].sort()).toEqual(["work.job", "work.job.step"]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("a mount-relative routine work.job.** runs work.job and work.job.step", async () => {
		const api = await slothlet({ dir: BASE, mode, runtime, silent: true, routines: [{ name: "work.job.**", mode: "manual" }] });
		try {
			await api["work.job.**"]();
			expect([...globalThis.__slothletGlobstarLog].sort()).toEqual(["work.job", "work.job.step"]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("hidden: tools.** hides the root file tools.mjs as well as the folder's files", async () => {
		const api = await slothlet({ dir: BASE, mode, runtime, silent: true, hidden: ["tools.**"] });
		try {
			expect(api.tools).toBeUndefined();
			expect(await api.other.ping()).toBe("pong");
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("hidden: tools/** written folder-style hides the same", async () => {
		const api = await slothlet({ dir: BASE, mode, runtime, silent: true, hidden: "tools/**" });
		try {
			expect(api.tools).toBeUndefined();
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it("without hidden, both the root file and the folder are there", async () => {
		const api = await slothlet({ dir: BASE, mode, runtime, silent: true });
		try {
			expect(await api.tools.top()).toBe("top");
			expect(await api.tools.sub.deep()).toBe("deep");
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
