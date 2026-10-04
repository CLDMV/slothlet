/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-live-view-writes.test.vitest.mjs
 *	@Date: 2026-09-28T06:11:59-07:00 (1790601119)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:14 -07:00 (1791083054)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression coverage for #495 — object- and function-valued writes through a live
 * view (a wrap-on-set graft, including one hung off an `api.slothlet.api.add()`-mounted leaf) must
 * land on the underlying object exactly like primitive writes already do (#340), be served back
 * wrapped from that object on read, and never shadow later updates made to the underlying object.
 *
 * Every behavioural case runs through both routes and both modes:
 *  - `self.store.x = held` wrap-on-set from a base module (`api.store.x` is the view)
 *  - `self.devices.d1.connection = conn` from a module mounted via `api.slothlet.api.add("devices.d1", …)`
 *    (`api.devices.d1.connection` is the view — the droidsock `device.connection` case)
 */
import { describe, it, expect, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import net from "node:net";
import slothlet from "../../../../index.mjs";
import { resolveWrapper } from "#handlers/unified-wrapper";

const BASE = new URL("../../../../api_tests/api_test_live_view", import.meta.url).pathname;
const DEVICE_DIR = new URL("../../../../api_tests/api_test_live_view_device", import.meta.url).pathname;

/**
 * Route descriptors. `setup` returns the raw object the module holds privately, a `view()` getter
 * that re-reads the view through the api every time, and the module's own raw-reference readers.
 */
const ROUTES = {
	"wrap-on-set (self.X = obj)": {
		async setup(api) {
			const raw = await api.store.assign();
			return {
				raw,
				view: () => api.store.x,
				features: () => api.store.features(),
				dispatchRaw: (packet) => api.store.dispatchRaw(packet),
				setFeaturesViaSelf: (value) => api.store.setFeaturesViaSelf(value)
			};
		}
	},
	"api.add()-mounted leaf": {
		async setup(api) {
			await api.slothlet.api.add("devices.d1", DEVICE_DIR, { moduleID: "device-d1" });
			const raw = await api.devices.d1.session.open();
			return {
				raw,
				view: () => api.devices.d1.connection,
				features: () => api.devices.d1.session.features(),
				dispatchRaw: (packet) => api.devices.d1.session.dispatchRaw(packet),
				setFeaturesViaSelf: (value) => api.devices.d1.session.setFeaturesViaSelf(value)
			};
		}
	}
};

describe.each(["eager", "lazy"])("UnifiedWrapper > live view object/function writes (#495) [%s]", (mode) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	describe.each(Object.keys(ROUTES))("%s", (routeName) => {
		const route = ROUTES[routeName];

		const boot = async (extra = {}) => {
			api = await slothlet({ base: BASE, mode, permissions: { defaultPolicy: "allow" }, ...extra });
			return route.setup(api);
		};

		it("an object write through the view reaches the underlying object", async () => {
			const { raw, view, features } = await boot();
			const cmds = ["cmd"];

			view().deviceFeatures = cmds;

			expect(raw.deviceFeatures).toBe(cmds);
			expect(raw.deviceFeatures).toEqual(["cmd"]);
			// The module's own method reading its private reference sees the write (droidsock deviceFeatures).
			expect(await features()).toEqual(["cmd"]);
			// Served back through the view, wrapped from the underlying object.
			expect([...view().deviceFeatures]).toEqual(["cmd"]);
			expect(view().deviceFeatures.length).toBe(1);
			expect(resolveWrapper(view().deviceFeatures)).not.toBeNull();
		});

		it("a write made from inside the owning module through self reaches the underlying object", async () => {
			const { raw, setFeaturesViaSelf } = await boot();

			const readBack = await setFeaturesViaSelf(["from-self"]);

			expect([...readBack]).toEqual(["from-self"]);
			expect(raw.deviceFeatures).toEqual(["from-self"]);
		});

		it("a nested object write through the view reaches the underlying object", async () => {
			const { raw, view } = await boot();

			view().nested.inner.c = { a: 1 };

			expect(raw.nested.inner.c).toEqual({ a: 1 });
			expect(view().nested.inner.c.a).toBe(1);

			// And a primitive write below the written object is still two-way.
			view().nested.inner.c.a = 2;
			expect(raw.nested.inner.c.a).toBe(2);
		});

		it("a function write through the view reaches the underlying object and is callable from either side", async () => {
			const { raw, view, dispatchRaw } = await boot();
			const handler = (packet) => `got:${packet}`;

			view().onUnhandledPacket = handler;

			expect(raw.onUnhandledPacket).toBe(handler);
			expect(raw.dispatch("a")).toBe("got:a");
			expect(await dispatchRaw("b")).toBe("got:b");
			expect(await view().onUnhandledPacket("c")).toBe("got:c");
			expect(await view().dispatch("d")).toBe("got:d");
		});

		it("a later update of the key on the underlying object stays visible through the view (no shadowing)", async () => {
			const { raw, view, features } = await boot();

			view().deviceFeatures = ["cmd"];
			expect([...view().deviceFeatures]).toEqual(["cmd"]);

			raw.deviceFeatures = ["later"];
			expect([...view().deviceFeatures]).toEqual(["later"]);
			expect(await features()).toEqual(["later"]);

			// A cached nested child read earlier is not served stale after the raw object replaces it.
			expect(view().nested.inner).toBeDefined();
			raw.nested = { inner: { fresh: true } };
			expect(view().nested.inner.fresh).toBe(true);

			// A function replaced on the raw side is the one called through the view.
			view().onUnhandledPacket = () => "first";
			expect(await view().onUnhandledPacket()).toBe("first");
			raw.onUnhandledPacket = () => "second";
			expect(await view().onUnhandledPacket()).toBe("second");
		});

		it("a key can switch between primitive and object values in either direction", async () => {
			const { raw, view } = await boot();

			view().n = 10;
			expect(raw.n).toBe(10);
			raw.n = 11;
			expect(view().n).toBe(11);

			// primitive → object through the view
			view().n = { deep: 1 };
			expect(raw.n).toEqual({ deep: 1 });
			expect(view().n.deep).toBe(1);
			expect(resolveWrapper(view().n)).not.toBeNull();

			// object → primitive through the view
			view().n = 12;
			expect(raw.n).toBe(12);
			expect(view().n).toBe(12);

			// primitive → object on the raw side, after the view has a live primitive accessor for the key
			raw.n = { deep: 2 };
			expect(view().n.deep).toBe(2);
			expect(resolveWrapper(view().n)).not.toBeNull();
		});

		it("an EventEmitter written through the view stays the real instance and works through the view", async () => {
			const { raw, view } = await boot();
			const emitter = new EventEmitter();

			view().events = emitter;

			expect(raw.events).toBe(emitter);
			expect(view().events instanceof EventEmitter).toBe(true);
			let fired = null;
			view().events.on("ping", (value) => {
				fired = value;
			});
			emitter.emit("ping", 7);
			expect(fired).toBe(7);
		});

		it("a connected net.Socket written through the view keeps working native methods through the view", async () => {
			const { raw, view } = await boot();
			// Echo server: replies only after the client writes, so the client's listeners (attached
			// through the view) are guaranteed to be in place before any data arrives.
			const server = net.createServer((conn) => {
				conn.on("error", () => {});
				conn.on("data", (chunk) => conn.end(`echo:${chunk.toString()}`));
			});
			await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
			const socket = new net.Socket();
			socket.on("error", () => {});
			try {
				await new Promise((resolve, reject) => {
					socket.once("error", reject);
					socket.connect(server.address().port, "127.0.0.1", resolve);
				});

				view().socket = socket;

				expect(raw.socket).toBe(socket);
				expect(view().socket instanceof net.Socket).toBe(true);
				const received = await new Promise((resolve) => {
					let data = "";
					view().socket.on("data", (chunk) => {
						data += chunk.toString();
					});
					view().socket.on("end", () => resolve(data));
					// A native stream method called through the view (needs the real socket as `this`).
					view().socket.write("ping");
				});
				expect(received).toBe("echo:ping");
			} finally {
				socket.destroy();
				await new Promise((resolve) => server.close(resolve));
			}
		});
	});
});

describe("UnifiedWrapper > live view object/function writes (#495) — permissions, ownership, reload", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("read gating still applies to a value that was written through the view", async () => {
		api = await slothlet({
			base: BASE,
			mode: "eager",
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "untrusted.**", target: "store.**", effect: "deny" }]
			}
		});
		const raw = await api.store.assign();

		api.store.x.nested.inner.c = { a: 42 };
		expect(raw.nested.inner.c).toEqual({ a: 42 });

		// The owning module reads it back through the view.
		expect(await api.store.peek()).toBe(42);

		// A caller denied against store.** is refused on the written value too.
		await expect(async () => api.untrusted.peek()).rejects.toThrow(/PERMISSION_DENIED/);
	});

	it("an object write against a frozen underlying object throws instead of silently reporting success", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });
		const raw = await api.store.assign();
		const before = raw.deviceFeatures;
		Object.freeze(raw);

		// Reflect.set fails (returns false) on the frozen object; the set trap must propagate that
		// so the strict-mode assignment throws, exactly like the primitive-write path (#340).
		expect(() => {
			api.store.x.deviceFeatures = ["cmd"];
		}).toThrow(TypeError);
		expect(raw.deviceFeatures).toBe(before);
	});

	it("a write through a stale view of a removed module does not reach the old underlying object", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });
		await api.slothlet.api.add("devices.d1", DEVICE_DIR, { moduleID: "device-d1" });
		const conn = await api.devices.d1.session.open();
		const staleView = api.devices.d1.connection;

		await api.slothlet.api.remove("device-d1");

		// Removal invalidates the view and drops its live impl; a write through a retained stale
		// reference must not silently mutate the object the removed module used to publish.
		expect(resolveWrapper(staleView).____slothletInternal.impl).toBeNull();
		expect(() => {
			staleView.deviceFeatures = ["late"];
		}).not.toThrow();
		expect(conn.deviceFeatures).toEqual([]);
		expect(staleView.deviceFeatures).toBeUndefined();
	});

	it("a child adopted onto the view by an internal eager re-adopt is still served after adoption moved it off impl", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });
		await api.store.assign();
		const xWrapper = resolveWrapper(api.store.x);

		// ___setImpl -> _applyNewImpl -> ___adoptImplChildren (the collision/reload reuse path) adopts
		// `child` onto the wrapper and deletes it from the (cloned) impl. The live-view read
		// revalidation must only drop a cached child when impl still HAS the key with a different
		// value — never because adoption moved the key off impl.
		xWrapper.___setImpl({ y: 1, child: { k: 1 } }, null, true);
		expect("child" in xWrapper.____slothletInternal.impl).toBe(false);
		expect(api.store.x.child.k).toBe(1);
	});

	it("an object write onto an ORDINARY (non-live) namespace still stores a userAssigned wrapper on the namespace", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const extra = { a: 1 };
		api.store.extra = extra;

		// Not a live view: the value is wrap-on-set onto the namespace wrapper, tagged userAssigned.
		const extraWrapper = resolveWrapper(api.store.extra);
		expect(extraWrapper).not.toBeNull();
		expect(extraWrapper.____slothletInternal.userAssigned).toBe(true);
		expect(api.store.extra.a).toBe(1);
	});

	it("the view assigned on an api.add()-mounted leaf keeps its writes, and stays two-way, across a reload of that module", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });
		await api.slothlet.api.add("devices.d1", DEVICE_DIR, { moduleID: "device-d1" });
		const conn = await api.devices.d1.session.open();

		api.devices.d1.connection.deviceFeatures = ["cmd"];
		const handler = () => "handled";
		api.devices.d1.connection.onUnhandledPacket = handler;

		await api.slothlet.api.reload("device-d1");

		// The userAssigned `connection` view survives the reload (O15) and still fronts the same object.
		expect(resolveWrapper(api.devices.d1.connection).____slothletInternal.userAssigned).toBe(true);
		expect([...api.devices.d1.connection.deviceFeatures]).toEqual(["cmd"]);
		expect(await api.devices.d1.connection.onUnhandledPacket()).toBe("handled");
		expect(conn.deviceFeatures).toEqual(["cmd"]);

		// Still two-way after the reload.
		api.devices.d1.connection.deviceFeatures = ["after-reload"];
		expect(conn.deviceFeatures).toEqual(["after-reload"]);
		conn.deviceFeatures = ["raw-after-reload"];
		expect([...api.devices.d1.connection.deviceFeatures]).toEqual(["raw-after-reload"]);
	});

	it("the wrap-on-set view keeps its writes across a selective reload of its owning module", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });
		const raw = await api.store.assign();

		api.store.x.deviceFeatures = ["cmd"];

		await api.slothlet.api.reload("store");

		expect(resolveWrapper(api.store.x).____slothletInternal.userAssigned).toBe(true);
		expect([...api.store.x.deviceFeatures]).toEqual(["cmd"]);
		api.store.x.deviceFeatures = ["after-reload"];
		expect(raw.deviceFeatures).toEqual(["after-reload"]);
	});
});
