/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-unloaded-writes.test.vitest.mjs
 *	@Date: 2026-11-03T08:06:32-08:00 (1793721992)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T07:24:11-08:00 (1793805851)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A write through a lazy node that has not loaded yet lands once it loads, as in eager mode (#653).
 *
 * @description
 * Fixture `api_test_lazy_unloaded_write`:
 * ```
 * base/root.mjs              noop()
 * holder/owner.mjs           writeOwnInner()            — the module writing its own unloaded node through self
 * holder/deep/inner/leaf.mjs leaf()                     — loaded only when reached
 * holder/deep/cfg.mjs        frozen, getterOnly, guarded, plain
 * writer/ops.mjs             assign(), touch()          — another module, mounted as `writer` and as `intruder`
 * broken/deep/bad.mjs        fails to load while the test asks it to
 * race/a/x.mjs               getterOnly                 — its load waits on a gate the test opens
 * race/b/y.mjs               y()                        — a sibling reloaded on its own
 * ```
 * Reading a member of a node a lazy instance has not loaded hands back a stand-in for it until it loads. An
 * assignment, a definition, a deletion, or a new prototype made through the stand-in is judged at once, as the same
 * change on a loaded node is, and made on the node when it loads, as the module that made it. One the loaded node
 * refuses fails the next await or call through that node with `LAZY_WRITE_REFUSED`, and is named in a
 * `WARNING_LAZY_WRITE_REFUSED` warning when it is refused. Freezing, sealing, or closing the stand-in to extension
 * closes it at once and closes the node the same way when it loads, after the changes made before.
 *
 * @module tests/vitests/suites/lazy/lazy-unloaded-writes
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothletInstance from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { refusedChangeCount, resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

/**
 * Create an instance with `permissions.provenance` pinned off (#597, #682): under vitest this file's code is
 * transformed, so it cannot be verified as the host's own source.
 * @param {object} config - The instance's configuration.
 * @returns {Promise<object>} The api.
 */
const slothlet = (config) =>
	slothletInstance(config?.permissions ? { ...config, permissions: { provenance: false, ...config.permissions } } : config);

const FIXTURE = TEST_DIRS.API_TEST_LAZY_UNLOADED_WRITE;
const BREAK = Symbol.for("slothlet.test.i653.break");

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the code (or error name) it was refused with.
 */
function outcome(change) {
	try {
		change();
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Report what awaiting a value gives: `"ok"` or the code it rejected with.
 * @param {*} value - What to await.
 * @returns {Promise<string>} The outcome.
 */
async function settled(value) {
	try {
		await value;
		return "ok";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

describe.each([{ runtime: "async" }, { runtime: "live" }])("writes through an unloaded lazy node (#653) — $runtime", ({ runtime }) => {
	let api;

	afterEach(async () => {
		delete globalThis[BREAK];
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and mount the holder and the two writer modules.
	 * @param {"eager"|"lazy"} mode - The instance's mode.
	 * @param {object} [options] - More configuration.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(mode, options = {}) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
		await api.slothlet.api.add("writer", path.join(FIXTURE, "writer"), { moduleID: "writer" });
		await api.slothlet.api.add("intruder", path.join(FIXTURE, "writer"), { moduleID: "intruder" });
		return api;
	}

	/**
	 * Make every change eager mode accepts, before anything below `holder` has loaded, then load and report.
	 * @param {"eager"|"lazy"} mode - The instance's mode.
	 * @returns {Promise<object>} What landed.
	 */
	async function acceptedShapes(mode) {
		await load(mode);
		const proto = { marker: "proto" };
		const made = {
			planted: outcome(() => {
				api.holder.deep.inner.planted = 1;
			}),
			twice: outcome(() => {
				api.holder.deep.inner.twice = 1;
				api.holder.deep.inner.twice = 2;
				api.holder.deep.inner.twice = 3;
			}),
			writeThenDelete: outcome(() => {
				api.holder.deep.inner.gone = 1;
				delete api.holder.deep.inner.gone;
			}),
			overLeaf: outcome(() => {
				api.holder.deep.inner.leaf = 5;
			}),
			frozen: outcome(() => {
				api.holder.deep.cfg.frozen.a = 2;
				api.holder.deep.cfg.frozen.b = 3;
			}),
			removePlain: outcome(() => {
				delete api.holder.deep.cfg.plain.p;
			}),
			define: outcome(() => Object.defineProperty(api.holder.deep.inner, "defined", { value: 6, configurable: true, writable: true })),
			defineFixed: outcome(() => Object.defineProperty(api.holder.deep.inner, "fixed", { value: 7, enumerable: true })),
			setPrototype: outcome(() => Object.setPrototypeOf(api.holder.deep.cfg.plain, proto)),
			byOwner: await api.holder.owner.writeOwnInner("byOwner", 8),
			byWriter: await api.writer.ops.assign("byWriter", 9)
		};
		const inner = await api.holder.deep.inner;
		const frozen = await api.holder.deep.cfg.frozen;
		const plain = await api.holder.deep.cfg.plain;
		const result = {
			made,
			planted: inner.planted,
			twice: inner.twice,
			gone: "gone" in inner,
			leaf: inner.leaf,
			frozenA: frozen.a,
			frozenB: frozen.b,
			plainP: plain.p,
			defined: inner.defined,
			fixed: Object.getOwnPropertyDescriptor(inner, "fixed")?.configurable,
			fixedValue: inner.fixed,
			// What a new prototype on a node shows is eager mode's to decide; lazy mode only has to show the same.
			prototype: Object.getPrototypeOf(plain) === proto,
			byOwner: inner.byOwner,
			byWriter: inner.byWriter
		};
		await api.slothlet.shutdown();
		api = null;
		return result;
	}

	it("lands every change eager mode accepts once the node loads, as eager mode does", async () => {
		const eager = await acceptedShapes("eager");
		const lazy = await acceptedShapes("lazy");
		expect(lazy).toEqual(eager);
		expect(lazy).toMatchObject({
			planted: 1,
			twice: 3,
			gone: false,
			leaf: 5,
			frozenA: 2,
			frozenB: 3,
			plainP: undefined,
			defined: 6,
			fixed: false,
			fixedValue: 7,
			byOwner: 8,
			byWriter: 9
		});
	});

	it("lands a queued write before any await of the node resolves, however many are waiting", async () => {
		await load("lazy");
		api.holder.deep.inner.planted = 1;
		const [first, second, called] = await Promise.all([api.holder.deep.inner, api.holder.deep.inner, api.holder.deep.inner.leaf()]);
		expect(first.planted).toBe(1);
		expect(second.planted).toBe(1);
		expect(called).toBe("leaf");
	});

	it("makes a write through a stand-in whose node has loaded at once, refusals included", async () => {
		await load("lazy");
		const inner = api.holder.deep.inner;
		await inner;
		inner.late = 4;
		expect(api.holder.deep.inner.late).toBe(4);
		const getterOnly = api.holder.deep.cfg.getterOnly;
		await getterOnly;
		expect(() => {
			getterOnly.g = 2;
		}).toThrow(TypeError);
	});

	it("defines, deletes, and sets the prototype through a stand-in whose node has loaded at once, as eager mode does", async () => {
		const reports = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			const plain = api.holder.deep.cfg.plain;
			const inner = api.holder.deep.inner;
			await plain;
			await inner;
			reports[mode] = {
				define: outcome(() => Object.defineProperty(inner, "defined", { value: 1, configurable: true })),
				fixed: outcome(() => Object.defineProperty(inner, "fixed", { value: 2 })),
				removeFixed: outcome(() => {
					delete inner.fixed;
				}),
				remove: outcome(() => {
					delete plain.p;
				}),
				prototype: outcome(() => Object.setPrototypeOf(plain, null)),
				landed: [api.holder.deep.inner.defined, api.holder.deep.inner.fixed, api.holder.deep.cfg.plain.p]
			};
			await api.slothlet.shutdown();
			api = null;
		}
		expect(reports.lazy).toEqual(reports.eager);
		expect(reports.lazy.landed).toEqual([1, 2, undefined]);
	});

	it("keeps a member defined fixed through an unloaded node, as eager mode does", async () => {
		const reports = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			const inner = api.holder.deep.inner;
			reports[mode] = {
				fixed: outcome(() => Object.defineProperty(inner, "fixed", { value: 2, configurable: false })),
				removeFixed: outcome(() => {
					delete inner.fixed;
				}),
				assignFixed: outcome(() => {
					inner.fixed = 3;
				}),
				redefineFixed: outcome(() => Object.defineProperty(inner, "fixed", { value: 4 }))
			};
			reports[mode].landed = (await api.holder.deep.inner).fixed;
			await api.slothlet.shutdown();
			api = null;
		}
		expect(reports.lazy).toEqual(reports.eager);
		expect(reports.lazy).toEqual({
			fixed: "done",
			removeFixed: "TypeError",
			assignFixed: "TypeError",
			redefineFixed: "TypeError",
			landed: 2
		});
	});

	/**
	 * How a node reads once closed: `"frozen"`, `"sealed"`, `"closed"`, or `"open"`.
	 * @param {object} node - The node.
	 * @returns {string} Its state.
	 */
	const lockState = (node) =>
		Object.isFrozen(node) ? "frozen" : Object.isSealed(node) ? "sealed" : Object.isExtensible(node) ? "open" : "closed";

	it.each([
		["freeze", "frozen"],
		["seal", "sealed"],
		["preventExtensions", "closed"]
	])("closes the node with %s once it loads, as eager mode does", async (kind, expected) => {
		const reports = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			const standIn = api.holder.deep.inner;
			reports[mode] = { made: outcome(() => Object[kind](standIn)), standIn: lockState(standIn) };
			reports[mode].node = lockState(await api.holder.deep.inner);
			await api.slothlet.shutdown();
			api = null;
		}
		expect(reports.lazy).toEqual(reports.eager);
		expect(reports.lazy).toEqual({ made: "done", standIn: expected, node: expected });
	});

	it("lands a write made before the node was closed, and refuses one after, as eager mode does", async () => {
		const reports = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			const inner = api.holder.deep.inner;
			const plain = api.holder.deep.cfg.plain;
			const frozenExport = api.holder.deep.cfg.frozen;
			reports[mode] = {
				before: outcome(() => {
					inner.before = 1;
				}),
				freeze: outcome(() => Object.freeze(inner)),
				after: outcome(() => {
					inner.after = 2;
				}),
				define: outcome(() => Object.defineProperty(inner, "defined", { value: 3 })),
				prototype: outcome(() => Object.setPrototypeOf(inner, {})),
				closePlain: outcome(() => Object.preventExtensions(plain)),
				sealFrozenExport: outcome(() => Object.seal(frozenExport))
			};
			const node = await api.holder.deep.inner;
			reports[mode].landed = [node.before, node.after, node.defined, lockState(node)];
			reports[mode].others = [lockState(await api.holder.deep.cfg.plain), lockState(await api.holder.deep.cfg.frozen)];
			await api.slothlet.shutdown();
			api = null;
		}
		expect(reports.lazy).toEqual(reports.eager);
		expect(reports.lazy).toMatchObject({
			before: "done",
			freeze: "done",
			after: "TypeError",
			define: "TypeError",
			prototype: "TypeError",
			landed: [1, undefined, undefined, "frozen"],
			others: ["closed", "sealed"]
		});
	});

	it("closes the node to the strongest state any stand-in for it reached", async () => {
		await load("lazy");
		Object.preventExtensions(api.holder.deep.inner);
		expect(await api.writer.ops.close("seal")).toBe("done");
		expect(await api.holder.owner.closeOwnInner("freeze")).toBe("done");
		expect(lockState(await api.holder.deep.inner)).toBe("frozen");
	});

	it("refuses a new member through a stand-in closed to extension once the node loads, and warns", async () => {
		const warned = SlothletWarning.captured.length;
		SlothletWarning.suppressConsole = true;
		try {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode: "lazy", runtime });
			await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
			const inner = api.holder.deep.inner;
			Object.preventExtensions(inner);
			inner.leaf = 5;
			inner.added = 1;
			expect(await settled(api.holder.deep.inner)).toBe("LAZY_WRITE_REFUSED");
			const node = api.holder.deep.inner;
			expect([node.leaf, node.added, Object.isExtensible(node)]).toEqual([5, undefined, false]);
			const warnings = SlothletWarning.captured.slice(warned).filter((warning) => warning.code === "WARNING_LAZY_WRITE_REFUSED");
			expect(warnings.map((warning) => warning.context.apiPath)).toEqual(["holder.deep.inner"]);
			expect(warnings[0].cause).toBeInstanceOf(TypeError);
		} finally {
			SlothletWarning.suppressConsole = false;
		}
	});

	it("warns of a refused change that nothing awaits", async () => {
		const warned = SlothletWarning.captured.length;
		SlothletWarning.suppressConsole = true;
		try {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode: "lazy", runtime });
			await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
			api.holder.deep.cfg.getterOnly.g = 2;
			// Loaded through another member, not through a stand-in the refused change was made on.
			await api.holder.deep.cfg.plain;
			const warnings = SlothletWarning.captured.slice(warned).filter((warning) => warning.code === "WARNING_LAZY_WRITE_REFUSED");
			expect(warnings.map((warning) => [warning.context.apiPath, warning.context.operation])).toEqual([
				["holder.deep.cfg.getterOnly", "set"]
			]);
		} finally {
			SlothletWarning.suppressConsole = false;
		}
	});

	it("warns of nothing when the instance is silent", async () => {
		const warned = SlothletWarning.captured.length;
		SlothletWarning.suppressConsole = true;
		try {
			await load("lazy");
			api.holder.deep.cfg.getterOnly.g = 2;
			expect(await settled(api.holder.deep.cfg.getterOnly)).toBe("LAZY_WRITE_REFUSED");
			expect(SlothletWarning.captured.slice(warned).filter((warning) => warning.code === "WARNING_LAZY_WRITE_REFUSED")).toEqual([]);
		} finally {
			SlothletWarning.suppressConsole = false;
		}
	});

	it.each(["freeze", "seal"])("closes an object node with %s once it loads, refusing nothing, as eager mode does", async (kind) => {
		const warned = SlothletWarning.captured.length;
		SlothletWarning.suppressConsole = true;
		try {
			const reports = {};
			for (const mode of ["eager", "lazy"]) {
				api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime });
				await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
				const made = outcome(() => Object[kind](api.holder.deep.cfg.plain));
				const awaited = await settled(api.holder.deep.cfg.plain);
				reports[mode] = [made, awaited, lockState(api.holder.deep.cfg.plain), api.holder.deep.cfg.plain.p];
				await api.slothlet.shutdown();
				api = null;
			}
			expect(reports.lazy).toEqual(reports.eager);
			expect(reports.lazy).toEqual(["done", "ok", kind === "freeze" ? "frozen" : "sealed", 1]);
			expect(SlothletWarning.captured.slice(warned).filter((warning) => warning.code === "WARNING_LAZY_WRITE_REFUSED")).toEqual([]);
		} finally {
			SlothletWarning.suppressConsole = false;
		}
	});

	it("refuses a callable `then` defined through an unloaded node at once, as eager mode does", async () => {
		const codes = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			codes[mode] = [
				outcome(() => Object.defineProperty(api.holder.deep.inner, "then", { value: () => {}, configurable: true })),
				outcome(() => Object.defineProperty(api.holder.deep.inner, "then", { get: () => () => {}, configurable: true }))
			];
			await api.slothlet.shutdown();
			api = null;
		}
		expect(codes.lazy).toEqual(codes.eager);
		expect(codes.lazy).toEqual(["API_MEMBER_THEN_RESERVED", "API_MEMBER_THEN_RESERVED"]);
	});

	it("runs a queued assignment's setter in the context it was made in, not the one that loads the node", async () => {
		const tenants = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			await api.slothlet.context.run({ tenant: "A" }, () => {
				api.holder.deep.ctx.probe.s = 1;
			});
			await api.slothlet.context.run({ tenant: "B" }, async () => {
				await api.holder.deep.ctx.probe;
			});
			tenants[mode] = await api.holder.deep.ctx.tenants();
			await api.slothlet.shutdown();
			api = null;
		}
		expect(tenants.lazy).toEqual(tenants.eager);
		expect(tenants.lazy).toEqual(["A"]);
	});

	it("answers `in` and the descriptor for a member its reader assigned through it, until deleted", async () => {
		await load("lazy");
		const inner = api.holder.deep.inner;
		inner.planted = 1;
		Object.defineProperty(inner, "defined", { get: () => 2, enumerable: true, configurable: true });
		expect(await api.writer.ops.assign("byWriter", 3)).toBe("done");
		expect(["planted" in inner, "defined" in inner, "never" in inner]).toEqual([true, true, false]);
		expect(Object.getOwnPropertyDescriptor(inner, "planted")).toEqual({ value: 1, writable: true, enumerable: true, configurable: true });
		expect(typeof Object.getOwnPropertyDescriptor(inner, "defined").get).toBe("function");
		// Another module's queued value is read through the node's gates once it loads, not through the host's stand-in.
		expect("byWriter" in inner).toBe(false);
		delete inner.planted;
		expect("planted" in inner).toBe(false);
		expect(Object.getOwnPropertyDescriptor(inner, "planted")).toBeUndefined();
		const node = await api.holder.deep.inner;
		expect(["planted" in node, node.defined, node.byWriter]).toEqual([false, 2, 3]);
	});

	it("reads a member defined fixed through an unloaded node, new or existing, as eager mode does", async () => {
		const reports = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			const inner = api.holder.deep.inner;
			Object.defineProperty(inner, "fixedNew", { value: 1, configurable: false, writable: false });
			Object.defineProperty(inner, "leaf", { value: () => "fixed", configurable: false, writable: false });
			reports[mode] = [
				inner.fixedNew,
				api.holder.deep.inner.fixedNew,
				inner.leaf(),
				Object.getOwnPropertyDescriptor(inner, "fixedNew").value
			];
			await api.slothlet.shutdown();
			api = null;
		}
		expect(reports.lazy).toEqual(reports.eager);
		expect(reports.lazy).toEqual([1, 1, "fixed", 1]);
	});

	it("shows a module the members it queued from any of its functions, and the host only its own", async () => {
		const reports = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			expect(await api.writer.ops.assign("byWriter", 1)).toBe("done");
			api.holder.deep.inner.byHost = 2;
			reports[mode] = [await api.writer.ops.peek("byWriter"), await api.writer.ops.peek("byHost"), "byHost" in api.holder.deep.inner];
			await api.slothlet.shutdown();
			api = null;
		}
		expect(reports.lazy[0]).toBe(reports.eager[0]);
		expect(reports.lazy[2]).toBe(reports.eager[2]);
		expect(reports.lazy).toEqual([true, false, true]);
	});

	it("treats writes queued before a module reload as writes made on the loaded node", async () => {
		const grant = { permissions: { rules: [{ caller: "writer.**", target: "holder.**:write", effect: "allow" }] } };
		const reports = {};
		for (const variant of ["loaded", "queued"]) {
			await load("lazy", grant);
			if (variant === "loaded") await api.holder.deep.inner;
			api.holder.deep.inner.planted = 1;
			expect(await api.writer.ops.assign("byWriter", 2)).toBe("done");
			await api.slothlet.api.reload("holder");
			const inner = await api.holder.deep.inner;
			reports[variant] = [inner.planted, inner.byWriter];
			await api.slothlet.shutdown();
			api = null;
		}
		expect(reports.queued).toEqual(reports.loaded);
	});

	it("makes a write queued before a module reload before the reload, so a refused one is still reported", async () => {
		const warned = SlothletWarning.captured.length;
		SlothletWarning.suppressConsole = true;
		try {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode: "lazy", runtime });
			await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
			api.holder.deep.cfg.getterOnly.g = 2;
			await api.slothlet.api.reload("holder");
			const warnings = SlothletWarning.captured.slice(warned).filter((warning) => warning.code === "WARNING_LAZY_WRITE_REFUSED");
			expect(warnings.map((warning) => warning.context.apiPath)).toEqual(["holder.deep.cfg.getterOnly"]);
		} finally {
			SlothletWarning.suppressConsole = false;
		}
	});

	it("handles a whole-instance reload as eager mode does, with nothing left to replay or refuse", async () => {
		const warned = SlothletWarning.captured.length;
		SlothletWarning.suppressConsole = true;
		try {
			const reports = {};
			for (const mode of ["eager", "lazy"]) {
				api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime });
				await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
				api.holder.deep.inner.planted = 1;
				await api.slothlet.reload();
				const awaited = await settled(api.holder.deep.inner);
				reports[mode] = [awaited, api.holder.deep.inner.planted];
				await api.slothlet.shutdown();
				api = null;
			}
			expect(reports.lazy).toEqual(reports.eager);
			expect(reports.lazy[0]).toBe("ok");
			expect(SlothletWarning.captured.slice(warned).filter((warning) => warning.code === "WARNING_LAZY_WRITE_REFUSED")).toEqual([]);
		} finally {
			SlothletWarning.suppressConsole = false;
		}
	});

	it("leaves a loaded node as it is when a change made on it was refused, as eager mode does", async () => {
		const reports = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			const made = outcome(() => {
				api.holder.deep.cfg.getterOnly.g = 2;
			});
			// Loaded through a sibling, so no stand-in for the node is awaited.
			await api.holder.deep.cfg.plain;
			const returned = api.holder.owner.syncNode();
			reports[mode] = {
				made,
				sync: !(returned instanceof Promise),
				then: typeof api.holder.deep.cfg.getterOnly.then,
				g: returned instanceof Promise ? "promise" : returned.g
			};
			await api.slothlet.shutdown();
			api = null;
		}
		expect(reports.lazy).toEqual({ ...reports.eager, made: "done" });
		expect(reports.lazy).toEqual({ made: "done", sync: true, then: "undefined", g: 1 });
	});

	it("hands back a promise from a stand-in's `then` called with one callback", async () => {
		await load("lazy");
		api.holder.deep.cfg.getterOnly.g = 2;
		let returned;
		expect(
			outcome(() => {
				returned = api.holder.deep.cfg.getterOnly.then((value) => value);
			})
		).toBe("done");
		expect(returned).toBeInstanceOf(Promise);
		expect(await settled(returned)).toBe("LAZY_WRITE_REFUSED");
		expect(await api.holder.deep.inner.then((inner) => typeof inner.leaf)).toBe("function");
	});

	it("loads, on a module reload, only the nodes holding changes made under that module", async () => {
		const gate = Symbol.for("slothlet.test.i653.gate");
		let open;
		globalThis[gate] = new Promise((resolve) => {
			open = resolve;
		});
		try {
			await load("lazy");
			await api.slothlet.api.add("slow", path.join(FIXTURE, "slow"), { moduleID: "slow" });
			// The node holding this change cannot load until the gate opens.
			api.slow.hold.wait.x = 1;
			const reloaded = api.slothlet.api.reload("writer").then(() => "reloaded");
			const timer = new Promise((resolve) => setTimeout(() => resolve("waiting"), 2000));
			expect(await Promise.race([reloaded, timer])).toBe("reloaded");
		} finally {
			open();
			delete globalThis[gate];
		}
		expect((await api.slow.hold.wait).x).toBe(1);
	});

	describe("refusals of queued changes", () => {
		/**
		 * Queue a change the loaded node refuses, then load the node through another member so nothing takes the refusal.
		 * @returns {Promise<void>}
		 */
		async function leaveRefusal() {
			api.holder.deep.cfg.getterOnly.g = 2;
			await api.holder.deep.cfg.plain;
		}

		it("are dropped when the node is reloaded", async () => {
			await load("lazy");
			const instance = resolveWrapper(api.holder).slothlet;
			for (let round = 0; round < 3; round++) {
				await leaveRefusal();
				expect(refusedChangeCount(instance)).toBe(1);
				await api.slothlet.api.reload("holder");
				expect(refusedChangeCount(instance)).toBe(0);
			}
			expect(await settled(api.holder.deep.cfg.getterOnly)).toBe("ok");
		});

		it.each([["race.b"], ["race.a"], ["race"]])(
			"are dropped when the module is reloaded while the load making them runs (reload %s)",
			async (reloadPath) => {
				const gate = Symbol.for("slothlet.test.i653.raceGate");
				let open;
				globalThis[gate] = new Promise((resolve) => {
					open = resolve;
				});
				try {
					await load("lazy");
					await api.slothlet.api.add("race", path.join(FIXTURE, "race"), { moduleID: "race" });
					await api.race;
					// The read starts `a`'s load, which waits on the gate; the change is refused when it finishes.
					api.race.a.x.getterOnly.g = 2;
					const reloaded = api.slothlet.api.reload(reloadPath);
					open();
					await reloaded;
				} finally {
					open();
					delete globalThis[gate];
				}
				expect(await settled(api.race.a.x.getterOnly)).toBe("ok");
			}
		);

		it("are dropped when the module is removed and added again", async () => {
			await load("lazy");
			const instance = resolveWrapper(api.holder).slothlet;
			await leaveRefusal();
			await api.slothlet.api.remove("holder");
			await api.slothlet.api.add("holder", path.join(FIXTURE, "holder"), { moduleID: "holder" });
			expect(refusedChangeCount(instance)).toBe(0);
			expect(await settled(api.holder.deep.cfg.getterOnly)).toBe("ok");
		});

		it("are dropped when the whole instance reloads", async () => {
			await load("lazy");
			const instance = resolveWrapper(api.holder).slothlet;
			for (let round = 0; round < 3; round++) {
				await leaveRefusal();
				await api.slothlet.reload();
				expect(refusedChangeCount(instance)).toBe(0);
			}
			expect(await settled(api.holder.deep.cfg.getterOnly)).toBe("ok");
		});

		it("are dropped when the instance shuts down", async () => {
			await load("lazy");
			const instance = resolveWrapper(api.holder).slothlet;
			await leaveRefusal();
			expect(refusedChangeCount(instance)).toBe(1);
			await api.slothlet.shutdown();
			api = null;
			expect(refusedChangeCount(instance)).toBe(0);
		});
	});

	it("refuses a callable `then` at once, as eager mode does", async () => {
		const codes = {};
		for (const mode of ["eager", "lazy"]) {
			await load(mode);
			codes[mode] = outcome(() => {
				api.holder.deep.inner.then = () => {};
			});
			await api.slothlet.shutdown();
			api = null;
		}
		expect(codes).toEqual({ eager: "API_MEMBER_THEN_RESERVED", lazy: "API_MEMBER_THEN_RESERVED" });
	});

	it("fails the next await or call through a node that refused a queued write, then answers as usual", async () => {
		await load("lazy");
		api.holder.deep.cfg.getterOnly.g = 2;
		api.holder.deep.cfg.guarded.g = 2;
		api.holder.deep.nope.x = 1;
		// Each read below is made before anything has loaded, through a stand-in that waits for it.
		const refused = [];
		const reads = [api.holder.deep.cfg.getterOnly, api.holder.deep.cfg.guarded.run(), api.holder.deep.nope, api.holder.deep.cfg.plain];
		const outcomes = await Promise.all(
			reads.map(async (read) => {
				try {
					await read;
					return "ok";
				} catch (error) {
					refused.push(error);
					return error?.code ?? String(error);
				}
			})
		);
		expect(outcomes).toEqual(["LAZY_WRITE_REFUSED", "LAZY_WRITE_REFUSED", "LAZY_WRITE_REFUSED", "ok"]);
		for (const error of refused) expect(error.cause).toBeInstanceOf(TypeError);
		expect(api.holder.deep.cfg.getterOnly.g).toBe(1);
		expect(api.holder.deep.cfg.guarded.run()).toBe("ran");
		expect(api.holder.deep.nope).toBeUndefined();
	});

	it("fails only the first await through a node that refused a queued write", async () => {
		await load("lazy");
		api.holder.deep.cfg.getterOnly.g = 2;
		const first = api.holder.deep.cfg.getterOnly;
		const second = api.holder.deep.cfg.getterOnly;
		expect([await settled(first), await settled(second)]).toEqual(["LAZY_WRITE_REFUSED", "ok"]);
	});

	it("re-queues a write on a deeper node that has not loaded either", async () => {
		await load("lazy");
		api.holder.deep.inner.planted = 1;
		// Loading `deep` alone leaves `inner` unloaded; the write waits for it.
		await api.holder.deep.cfg;
		expect((await api.holder.deep.inner).planted).toBe(1);
	});

	it.each([
		["the node the stand-in waits for", (broken) => broken.deep.bad, (broken) => (broken.deep.bad.x = 1)],
		["a node further down", (broken) => broken.outer.inner, (broken) => (broken.outer.inner.x = 1)]
	])("discards the queued writes of %s when it fails to load, which fails as it does with none", async (_label, read, write) => {
		const codes = [];
		for (const written of [false, true]) {
			api = await slothlet({ base: path.join(FIXTURE, "base"), mode: "lazy", runtime, silent: true });
			await api.slothlet.api.add("broken", path.join(FIXTURE, "broken"), { moduleID: "broken" });
			globalThis[BREAK] = true;
			if (written) write(api.broken);
			codes.push(await withSuppressedSlothletErrorOutput(() => settled(read(api.broken))));
			delete globalThis[BREAK];
			await api.slothlet.shutdown();
			api = null;
		}
		expect(codes[1]).toBe(codes[0]);
		expect(codes[0]).not.toBe("ok");
	});

	describe("permissions", () => {
		const grant = { permissions: { rules: [{ caller: "writer.**", target: "holder.**:write", effect: "allow" }] } };

		it("judges a write through an unloaded node at once, exactly as on a loaded node", async () => {
			const options = {
				permissions: {
					rules: [
						{ caller: "writer.**", target: "holder.**:write", effect: "allow" },
						{ caller: "writer.**", target: "holder.deep.inner.secret:write", effect: "deny" }
					]
				}
			};
			const reports = {};
			for (const mode of ["eager", "lazy"]) {
				await load(mode, options);
				reports[mode] = await withSuppressedSlothletErrorOutput(async () => ({
					intruder: await api.intruder.ops.assign("byIntruder", 1),
					denied: await api.writer.ops.assign("secret", 1),
					granted: await api.writer.ops.assign("byWriter", 1)
				}));
				const inner = await api.holder.deep.inner;
				reports[mode].landed = [inner.byIntruder, inner.secret, inner.byWriter];
				await api.slothlet.shutdown();
				api = null;
			}
			expect(reports.lazy).toEqual(reports.eager);
			expect(reports.lazy).toEqual({
				intruder: "LOOSE_SET_NOT_OWNED",
				denied: "PERMISSION_DENIED",
				granted: "done",
				landed: [undefined, undefined, 1]
			});
		});

		it("judges closing an unloaded node at once and closes it as the module that closed it, as eager mode does", async () => {
			const reports = {};
			for (const mode of ["eager", "lazy"]) {
				const run = {};
				for (const [who, close] of [
					["owner", () => api.holder.owner.closeOwnInner("freeze")],
					["granted", () => api.writer.ops.close("seal")],
					["intruder", () => api.intruder.ops.close("freeze")]
				]) {
					await load(mode, grant);
					const made = await withSuppressedSlothletErrorOutput(close);
					run[who] = [made, lockState(await api.holder.deep.inner)];
					await api.slothlet.shutdown();
					api = null;
				}
				reports[mode] = run;
			}
			expect(reports.lazy).toEqual(reports.eager);
			expect(reports.lazy).toEqual({
				owner: ["done", "frozen"],
				granted: ["done", "sealed"],
				intruder: ["LOOSE_SET_NOT_OWNED", "open"]
			});
		});

		it("refuses a callable `then` a module defines through an unloaded node with the code eager mode gives", async () => {
			const codes = {};
			for (const mode of ["eager", "lazy"]) {
				await load(mode, grant);
				codes[mode] = await withSuppressedSlothletErrorOutput(async () => [
					await api.writer.ops.defineThen(),
					await api.intruder.ops.defineThen()
				]);
				await api.slothlet.shutdown();
				api = null;
			}
			expect(codes.lazy).toEqual(codes.eager);
			expect(codes.lazy).toEqual(["API_MEMBER_THEN_RESERVED", "API_MEMBER_THEN_RESERVED"]);
		});

		it("makes each queued write as the one who made it, whoever loads the node", async () => {
			await load("lazy", grant);
			expect(await api.writer.ops.assign("byWriter", 1)).toBe("done");
			api.holder.deep.inner.byHost = 2;
			// The intruder may neither write here nor have its standing used for the writes queued.
			expect(await withSuppressedSlothletErrorOutput(() => api.intruder.ops.touch())).toBe(true);
			const inner = await api.holder.deep.inner;
			expect([inner.byWriter, inner.byHost]).toEqual([1, 2]);
		});

		it("keeps module code off the framework's keys on an unloaded node with permissions off, as on a loaded one", async () => {
			const reports = {};
			for (const mode of ["eager", "lazy"]) {
				await load(mode);
				reports[mode] = await withSuppressedSlothletErrorOutput(() => api.writer.ops.assign("__metadata", 1));
				await api.slothlet.shutdown();
				api = null;
			}
			expect(reports.lazy).toBe(reports.eager);
			expect(reports.lazy).not.toBe("done");
		});
	});
});
