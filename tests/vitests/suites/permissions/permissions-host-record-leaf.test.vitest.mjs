/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-host-record-leaf.test.vitest.mjs
 *	@Date: 2026-11-08T12:12:39-08:00 (1794168759)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T14:46:13-08:00 (1794177973)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #717 — a leaf the host adds as an object is its own entity at its path, and only code its caller handed
 * in runs as the caller.
 *
 * @description
 * docs/PERMISSIONS.md, "Code a caller hands to a leaf runs as the caller": a leaf added with
 * `api.slothlet.api.add(path, { fn() {…} })` is identified by its path, whatever file its function was written in. While
 * it runs, everything inside its call runs as that leaf (its body, the host's helpers in any of the host's files, the
 * code of any package, including one the caller imports too) except the code the caller handed in: the caller's own
 * files, and evaluated code. A host function the host gave the module, or a package function the module passes in, runs
 * as the leaf.
 *
 * Rules: `ext.b.** → host.records.**` and `host.records.** → store.**` are allowed (and the same for `records.host`),
 * nothing lets `ext.b` open a store partition. `ext.b.work` makes each call with a mutable and a frozen argument; the
 * record leaves come from a host file (`host/records.mjs`) or are written in this file, and are mounted at
 * `host.records` or at `records.host`. Every answer is the same in eager and lazy mode, and in both runtimes.
 *
 * @module tests/vitests/suites/permissions/permissions-host-record-leaf
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { makeRecords, invoke as hostInvoke } from "../../../../api_tests/api_test_host_record_leaf/host/records.mjs";
import { openPartition } from "../../../../api_tests/api_test_host_record_leaf/host/partition-helper.mjs";
import { callThrough } from "../../../../api_tests/api_test_host_record_leaf/node_modules/host-pkg/index.mjs";
import { relay } from "../../../../api_tests/api_test_host_record_leaf/node_modules/c-pkg/index.mjs";
import { invoke as sharedInvoke } from "../../../../api_tests/api_test_host_record_leaf/node_modules/ext-pkg/index.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_host_record_leaf");
const PROBE = path.join(FIXTURE, "probe-records.mjs");

const RULES = [
	{ caller: "ext.b.**", target: "host.records.**", effect: "allow" },
	{ caller: "host.records.**", target: "store.**", effect: "allow" },
	{ caller: "ext.b.**", target: "records.host.**", effect: "allow" },
	{ caller: "records.host.**", target: "store.**", effect: "allow" },
	// The nodes ext.b makes itself (`made`, assigned, and `added`, its own `api.add`).
	{ caller: "ext.b.**", target: "slothlet.api.**", effect: "allow" },
	{ caller: "ext.b.**", target: "made:write", effect: "allow" },
	{ caller: "ext.b.**", target: "made.**:write", effect: "allow" },
	{ caller: "ext.b.**", target: "added:write", effect: "allow" },
	{ caller: "ext.b.**", target: "added.**:write", effect: "allow" },
	{ caller: "ext.b.**", target: "made.**", effect: "allow" },
	{ caller: "made.**", target: "store.**", effect: "allow" },
	{ caller: "ext.b.**", target: "added.**", effect: "allow" },
	{ caller: "added.**", target: "store.**", effect: "allow" }
];

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * Open a partition, reporting the code and caller it was refused with instead of throwing.
 * @param {() => object} getApi - The host's api.
 * @returns {string} The partition, or `"<code>:<caller>"`.
 */
function tryPartition(getApi) {
	try {
		return getApi().store.partition();
	} catch (error) {
		return `${error?.code}:${error?.context?.caller ?? null}`;
	}
}

/**
 * A helper of this file that opens a partition, as `partitionHere` is `host/records.mjs`'s.
 * @param {() => object} getApi - The host's api.
 * @returns {string} The partition.
 */
function partitionHere(getApi) {
	return getApi().store.partition();
}

/**
 * The same record leaves as `makeRecords`, written in this file.
 * @param {() => object} getApi - The host's api.
 * @returns {Record<string, Function>} The leaves.
 */
function inlineRecords(getApi) {
	return {
		apply(options) {
			const via = options?.via;
			if (via === "file") return openPartition(getApi);
			if (via === "package") return callThrough(() => getApi().store.partition());
			if (via === "packageCalls") return callThrough(getApi().store.partition);
			if (via === "otherPackage") return relay(() => getApi().store.partition());
			if (via === "otherPackageCalls") return relay(getApi().store.partition);
			if (via === "callerPackage") return sharedInvoke({ open: () => getApi().store.partition() }, "open");
			if (via === "callerPackageCalls") return sharedInvoke(getApi().store, "partition");
			return getApi().store.partition();
		},
		query(_) {
			return partitionHere(getApi);
		},
		run(fn, _) {
			return fn();
		},
		use(value) {
			return String(value.id);
		},
		convert(value) {
			return String(value);
		},
		async settle(value) {
			return await value;
		},
		async later(_) {
			// Registered in the leaf's synchronous part, then run after it returned its promise.
			const inTimer = new Promise((resolve) => setTimeout(() => resolve(tryPartition(getApi)), 1));
			const inReaction = Promise.resolve().then(() => tryPartition(getApi));
			await null;
			const afterAwait = tryPartition(getApi);
			const timerAfterAwait = await new Promise((resolve) => setTimeout(() => resolve(tryPartition(getApi)), 1));
			return { inTimer: await inTimer, inReaction: await inReaction, afterAwait, timerAfterAwait };
		}
	};
}

const REFUSED = { ok: false, code: "PERMISSION_DENIED", caller: "ext.b.work" };
const UNACCOUNTED = { ok: false, code: "PERMISSION_DENIED", caller: null };

/**
 * The table's rows: what `ext.b.work` calls, and what it gets back when the record leaves are mounted at `mount`.
 * @param {string} mount - The mount, dotted.
 * @returns {Array<[string, string, object]>} `[row, what reaches store.partition(), outcome]`.
 */
const rows = (mount) => [
	["apply", "the leaf body", { ok: true, value: `p:${mount}.apply` }],
	["query", "a host helper in the same host file", { ok: true, value: `p:${mount}.query` }],
	["applyFile", "a host helper in another host file", { ok: true, value: `p:${mount}.apply` }],
	["applyPackage", "a package only the host imports", { ok: true, value: `p:${mount}.apply` }],
	["applyPackageCalls", "a package only the host imports, calling the api itself", { ok: true, value: `p:${mount}.apply` }],
	["applyOtherPackage", "a package the host and another module (ext.c) import", { ok: true, value: `p:${mount}.apply` }],
	["applyOtherPackageCalls", "a package the host and ext.c import, calling the api itself", { ok: true, value: `p:${mount}.apply` }],
	["applyCallerPackage", "a package the host and ext.b both import, the leaf's own use", { ok: true, value: `p:${mount}.apply` }],
	["applyCallerPackageCalls", "a package the host and ext.b both import, calling the api itself", { ok: true, value: `p:${mount}.apply` }],
	["callback", "ext.b's callback", REFUSED],
	["getter", "a getter ext.b wrote in the argument", REFUSED],
	["toString", "a toString ext.b wrote in the argument", REFUSED],
	["proxy", "a Proxy trap ext.b wrote", REFUSED],
	["thenable", "a thenable ext.b wrote", REFUSED],
	["newFunction", "a new Function ext.b made", REFUSED],
	["eval", "eval code ext.b made", REFUSED],
	["vm", "vm code ext.b made", REFUSED],
	["package", "a package function ext.b imports, passed in", { ok: true, value: `p:${mount}.run` }],
	["hostFunction", "a host function the host gave ext.b, handed back (documented limit)", { ok: true, value: `p:${mount}.run` }],
	["imports", "a file of ext.b's outside its api folder, reached through a package scope's imports, passed in", REFUSED],
	["loaded", "a file of ext.b's a package's import() loaded, passed in", REFUSED],
	["copyViaPkg", "an untagged copy of ext.b's file, calling the api through a package", REFUSED],
	["written", "source ext.b had a package write beside itself and import (documented limit)", { ok: true, value: `p:${mount}.run` }]
];

/**
 * The nodes ext.b makes itself — `made`, which it assigns (no file at all), and `added`, which its own `api.add` mounts
 * as an object — are not leaves the host added: what runs inside them is decided as before #717 (inside a call handed
 * data that can still be changed, as the caller).
 * @type {Array<[string, string, object, object]>} `[row, what reaches store.partition(), mutable, frozen]`.
 */
// Code of ext.b's file no call accounts for answers as a leaf built from that file, whichever is found first.
const AUTHORED = { ok: false, code: "PERMISSION_DENIED", caller: expect.stringMatching(/^ext\.b\./) };

const MODULE_NODE_ROWS = [
	["madeOwn", "made's own body", REFUSED, { ok: true, value: "p:null" }],
	["madeInvoke", "a package function ext.b assigned as made.invoke", REFUSED, { ok: true, value: "p:null" }],
	["madeRun", "a package function ext.b passes to made.run", REFUSED, REFUSED],
	["addedOwn", "added's own body", REFUSED, AUTHORED],
	["addedInvoke", "a package function ext.b added as added.invoke", REFUSED, AUTHORED],
	["addedRun", "a package function ext.b passes to added.run", REFUSED, REFUSED]
];

/**
 * A function of this file the host hands modules, as `invoke` is `host/records.mjs`'s.
 * @param {object} obj - The object.
 * @param {string} name - The method's name.
 * @returns {unknown} What it returned.
 */
function inlineInvoke(obj, name) {
	return obj[name]();
}

/**
 * The rows measured in this process. Under vitest's runner a package a module imports is loaded by the runner, not
 * through slothlet's loader, so which module loaded a package is not recorded and a package cannot be told to be the
 * host's: the rows that run a package's code are measured under Node's own loader only, below. So is the copy of
 * ext.b's file a package loads, which the runner gives no active `self`.
 * @param {string} mount - The mount, dotted.
 * @returns {Array<[string, string, object]>} The rows.
 */
const PACKAGE_ROWS = [
	"written",
	"copyViaPkg",
	"applyPackage",
	"applyPackageCalls",
	"applyOtherPackage",
	"applyOtherPackageCalls",
	"applyCallerPackage",
	"applyCallerPackageCalls",
	"package"
];
const underRunner = (mount) => rows(mount).filter(([row]) => !PACKAGE_ROWS.includes(row));

/**
 * The export conditions this worker runs under, so the probe loads the same build of slothlet.
 * @returns {string[]} The conditions, as `--conditions=x` arguments.
 */
function probeConditions() {
	const conditions = [];
	process.execArgv.forEach((arg, index, all) => {
		if (arg.startsWith("--conditions=")) conditions.push(arg);
		else if ((arg === "--conditions" || arg === "-C") && all[index + 1]) conditions.push(`--conditions=${all[index + 1]}`);
	});
	return conditions;
}

const VARIANTS = [
	{ source: "a host file", mount: "host.records", make: makeRecords, invoke: hostInvoke },
	{ source: "this file", mount: "host.records", make: inlineRecords, invoke: inlineInvoke },
	{ source: "a host file", mount: "records.host", make: makeRecords, invoke: hostInvoke },
	{ source: "this file", mount: "records.host", make: inlineRecords, invoke: inlineInvoke }
];

describe.each(CONFIGS)("Permissions > a host record leaf is its own entity at its path (#717) — $mode/$runtime", ({ mode, runtime }) => {
	describe.each(VARIANTS)("leaves from $source at $mount", ({ mount, make, invoke }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({
				base: path.join(FIXTURE, "api"),
				mode,
				runtime,
				silent: true,
				permissions: { defaultPolicy: "deny", rules: RULES }
			});
			await api.slothlet.api.add(
				mount.split("."),
				make(() => api),
				{ moduleID: "host-records" }
			);
			await api.ext.b.prepare();
		});

		afterAll(async () => {
			await api?.slothlet.shutdown();
		});

		// docs/PERMISSIONS.md, "Under vite's module runner": which module loaded a package is not recorded, so a package's
		// code inside a leaf with no file is code no call accounts for. In a call handed data that can still be changed it
		// runs as the call that made the leaf's, and is refused. With a frozen argument the code doing the access decides: the
		// host's code is the leaf's, and a package calling an api node the leaf read is settled by that node, as the leaf; a
		// package that reads the api node itself (`invoke(store, "partition")`) is refused as code no call accounts for.
		it.each([
			["applyPackage", "mutable", false],
			["applyPackageCalls", "mutable", false],
			["applyOtherPackage", "mutable", false],
			["applyOtherPackageCalls", "mutable", false],
			["applyCallerPackage", "mutable", false],
			["applyCallerPackageCalls", "mutable", false],
			["package", "mutable", false],
			["package", "frozen", false],
			["applyCallerPackageCalls", "frozen", null],
			["applyPackage", "frozen", true],
			["applyOtherPackage", "frozen", true],
			["applyPackageCalls", "frozen", true],
			["applyOtherPackageCalls", "frozen", true],
			["applyCallerPackage", "frozen", true]
		])("places a package's code under vite's module runner: %s, %s", async (row, kind, allowed) => {
			const outcome = allowed ? { ok: true, value: `p:${mount}.apply` } : allowed === null ? UNACCOUNTED : REFUSED;
			expect(await api.ext.b.work(mount, row, kind, { invoke })).toEqual(outcome);
		});

		describe.each(["mutable", "frozen"])("handed a %s argument", (kind) => {
			it.each(underRunner(mount))("%s: reaches store.partition() through %s", async (row, _what, outcome) => {
				expect(await api.ext.b.work(mount, row, kind, { invoke })).toEqual(outcome);
			});
		});

		it.each(MODULE_NODE_ROWS)("decides a node ext.b made itself as before: %s, %s", async (row, _what, mutable, frozen) => {
			expect(await api.ext.b.work(mount, row, "mutable")).toEqual(mutable);
			expect(await api.ext.b.work(mount, row, "frozen")).toEqual(frozen);
		});

		// docs/PERMISSIONS.md, "In the live runtime": with no call awaiting the leaf, its code after an await runs as the leaf.
		it.each(["mutable", "frozen"])("runs the leaf's own code after an await no call awaits (%s)", async (kind) => {
			const leaf = `p:${mount}.later`;
			const outcome = await api.ext.b.work(mount, "laterDetached", kind);
			expect(await outcome.value.pending).toEqual({ inTimer: leaf, inReaction: leaf, afterAwait: leaf, timerAfterAwait: leaf });
		});

		// The async runtime carries the call across every await, timer and reaction. The live runtime carries it into a
		// timer or a reaction registered in the leaf's synchronous part; once the leaf resumes after an await its frames
		// place on no call, so the job is placed by the flow awaiting it: the caller.
		it.each(["mutable", "frozen"])("runs the leaf's own code in its timers, its reactions and after an await (%s)", async (kind) => {
			const leaf = `p:${mount}.later`;
			const resumed = runtime === "async" ? leaf : "PERMISSION_DENIED:ext.b.work";
			expect(await api.ext.b.work(mount, "later", kind)).toEqual({
				ok: true,
				value: { inTimer: leaf, inReaction: leaf, afterAwait: resumed, timerAfterAwait: resumed }
			});
		});
	});
});

describe("Permissions > a host record leaf is its own entity at its path, under Node's own loader (#717)", () => {
	const result = spawnSync(process.execPath, [...probeConditions(), PROBE], { encoding: "utf8", timeout: 120000 });
	const out = result.status === 0 ? JSON.parse(result.stdout) : {};

	it("runs the probe cleanly", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	});

	describe.each(CONFIGS)("$mode/$runtime", ({ mode, runtime }) => {
		describe.each(["host.records", "records.host"])("leaves from a host file at %s", (mount) => {
			describe.each(["mutable", "frozen"])("handed a %s argument", (kind) => {
				it.each(rows(mount))("%s: reaches store.partition() through %s", (row, _what, outcome) => {
					expect(out[`${mode}/${runtime}/${mount}/${row}/${kind}`]).toEqual(outcome);
				});

				it("runs the leaf's own code after an await no call awaits", () => {
					const leaf = `p:${mount}.later`;
					expect(out[`${mode}/${runtime}/${mount}/laterDetached/${kind}`]).toEqual({
						ok: true,
						value: { inTimer: leaf, inReaction: leaf, afterAwait: leaf, timerAfterAwait: leaf }
					});
				});

				it("runs the leaf's own code in its timers, its reactions and after an await", () => {
					const leaf = `p:${mount}.later`;
					const resumed = runtime === "async" ? leaf : "PERMISSION_DENIED:ext.b.work";
					expect(out[`${mode}/${runtime}/${mount}/later/${kind}`]).toEqual({
						ok: true,
						value: { inTimer: leaf, inReaction: leaf, afterAwait: resumed, timerAfterAwait: resumed }
					});
				});
			});

			// docs/PERMISSIONS.md, "A file the host loads through a package a module imports too": its code is taken for the
			// module's.
			it("takes a host file the host loaded through a package ext.b imports too for ext.b's", () => {
				expect(out[`${mode}/${runtime}/${mount}/hostLoadedByPackage/mutable`]).toEqual(REFUSED);
				expect(out[`${mode}/${runtime}/${mount}/hostLoadedByPackage/frozen`]).toEqual(UNACCOUNTED);
			});

			it.each(MODULE_NODE_ROWS)("decides a node ext.b made itself as before: %s, %s", (row, _what, mutable, frozen) => {
				expect(out[`${mode}/${runtime}/${mount}/${row}/mutable`]).toEqual(mutable);
				expect(out[`${mode}/${runtime}/${mount}/${row}/frozen`]).toEqual(frozen);
			});
		});
	});
});
