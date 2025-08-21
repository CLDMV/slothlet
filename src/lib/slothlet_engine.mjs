// _engine.mjs
import { Worker } from "node:worker_threads";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import {
	asUrl,
	// VM path
	HAS_STM,
	makeNodeishContext,
	installContextGlobalsVM,
	bootSlothletVM,
	// shared
	normalizeContext,
	marshalArgsReplaceFunctions
} from "./slothlet_helpers.mjs";

let shutdownFn = null;
export function setShutdown(fn) {
	const prev = shutdownFn;
	shutdownFn = fn;
	return prev;
}

export async function createEngine(allOptions) {
	const { entry, mode = "vm" } = allOptions ?? {};
	if (!entry) throw new Error('createEngine: "entry" is required');

	// Split options for slothlet.load:
	const { context = null, reference = null, ...loadConfig } = allOptions;

	if (mode === "vm") {
		if (!HAS_STM) {
			// No STM: transparently fall back to worker to keep ESM without flags.
			return backendWorker(entry, loadConfig, { context, reference });
		}
		return backendVm(entry, loadConfig, { context, reference });
	}

	if (mode === "worker") {
		return backendWorker(entry, loadConfig, { context, reference });
	}

	if (mode === "fork" || mode === "child") {
		return backendFork(entry, loadConfig, { context, reference });
	}

	throw new Error(`Unknown mode "${mode}" (use "vm" | "worker" | "fork")`);
}

/* ---------------- VM backend (uses vm context) ---------------- */
async function backendVm(entry, loadConfig, ctxRef) {
	const context = makeNodeishContext();
	installContextGlobalsVM(context, ctxRef.context);
	await bootSlothletVM(context, asUrl(entry), loadConfig, ctxRef);

	// const portal = new context.Function("return _portal")();

	// const map = normalizeContext(userContext);
	// context.__ctx = map;
	// Wait for slothletReady to resolve before accessing _portal
	await vm.runInContext("slothletReady", context, { filename: "slothlet_engine-backendVm.mjs" });
	const portal = vm.runInContext("_portal", context, { filename: "slothlet_engine-backendVm.mjs" });
	// delete context.__ctx;
	const api = makeFacade({
		call: (path, args) => Promise.resolve(portal.call(path, args)),
		batch: (ops) => Promise.resolve(portal.batch(ops))
	});

	const dispose = async () => {};
	Object.defineProperty(api, "__dispose__", {
		value: dispose,
		writable: false,
		enumerable: false,
		configurable: false
	});
	return { api, dispose };
}

/* -------------- Worker backend (no inner VM) -------------- */
async function backendWorker(entry, loadConfig, ctxRef) {
	const workerPath = new URL("./slothlet_worker.mjs", import.meta.url);
	let nextId = 1;
	const pending = new Map();
	// Callback registry for marshalled functions
	let cbId = 1;
	const callbacks = new Map();

	const w = new Worker(workerPath, {
		workerData: {
			entry: asUrl(entry),
			loadConfig,
			// normalize context once so worker can just apply it
			contextMap: normalizeContext(ctxRef.context),
			reference: ctxRef.reference ?? null
		}
	});

	w.on("message", (msg) => {
		// Handle callback invocation requests from worker
		if (msg && msg.t === "callback" && typeof msg.cb === "number") {
			const fn = callbacks.get(msg.cb);
			if (!fn) {
				w.postMessage({ t: "callbackResult", cb: msg.cb, ok: false, error: "Callback not found" });
				return;
			}
			Promise.resolve()
				.then(() => fn(...(msg.args ?? [])))
				.then((result) => {
					w.postMessage({ t: "callbackResult", cb: msg.cb, ok: true, result });
				})
				.catch((error) => {
					w.postMessage({ t: "callbackResult", cb: msg.cb, ok: false, error: error?.message || String(error) });
				});
			return;
		}
		// Normal RPC response
		const { id, ok, result, error } = msg;
		const rec = pending.get(id);
		if (!rec) return;
		pending.delete(id);
		ok ? rec.resolve(result) : rec.reject(new Error(error));
	});

	// Register a callback and return its token
	function registerCb(fn) {
		const id = cbId++;
		callbacks.set(id, fn);
		return id;
	}

	// Marshal args, replacing functions with tokens
	function marshalArgs(args) {
		return marshalArgsReplaceFunctions(args, registerCb);
	}

	const rpc = (msg) =>
		new Promise((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve, reject });
			let message = { id, ...msg };
			// Marshal args if present
			if (Array.isArray(message.args)) {
				message = { ...message, args: marshalArgs(message.args) };
			}
			w.postMessage(message);
		});

	const api = makeFacade({
		call: (path, args) => rpc({ t: "call", path, args }),
		batch: (ops) => rpc({ t: "batch", ops })
	});

	const dispose = async () => {
		await rpc({ t: "dispose" });
		await w.terminate();
	};
	Object.defineProperty(api, "__dispose__", {
		value: dispose,
		writable: false,
		enumerable: false,
		configurable: false
	});
	return { api, dispose };
}

/* --------------- Fork backend (no inner VM) --------------- */
async function backendFork(entry, loadConfig, ctxRef) {
	const childPath = fileURLToPath(new URL("./slothlet_child.mjs", import.meta.url));
	let nextId = 1;
	const pending = new Map();

	const cp = fork(childPath, [], { stdio: ["inherit", "inherit", "inherit", "ipc"] });

	cp.on("message", ({ id, ok, result, error }) => {
		const rec = pending.get(id);
		if (!rec) return;
		pending.delete(id);
		ok ? rec.resolve(result) : rec.reject(new Error(error));
	});

	const rpc = (msg) =>
		new Promise((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve, reject });
			cp.send({ id, ...msg });
		});

	await rpc({
		t: "init",
		entry: asUrl(entry),
		loadConfig,
		contextMap: normalizeContext(ctxRef.context),
		reference: ctxRef.reference ?? null
	});

	const api = makeFacade({
		call: (path, args) => rpc({ t: "call", path, args }),
		batch: (ops) => rpc({ t: "batch", ops })
	});

	const dispose = async () => {
		await rpc({ t: "dispose" });
	};
	Object.defineProperty(api, "__dispose__", {
		value: dispose,
		writable: false,
		enumerable: false,
		configurable: false
	});
	return { api, dispose };
}

function makeFn(name) {
	const fn = function () {
		throw new Error("cross-thread stubs are not callable");
	};
	try {
		Object.defineProperty(fn, "name", { value: name || "", configurable: true });
	} catch {}
	return fn;
}

function revive(x) {
	if (x && typeof x === "object") {
		if ("__fn" in x) {
			// function box -> real function
			const fn = makeFn(x.__fn);
			const props = x.props || {};
			for (const [k, v] of Object.entries(props)) fn[k] = revive(v);
			return fn; // NOTE: no __fn/props left on the result
		}
		if (Array.isArray(x)) return x.map(revive);
		const out = {};
		for (const [k, v] of Object.entries(x)) out[k] = revive(v);
		return out;
	}
	return x;
}

/* ---------------- Host facade builder ---------------- */
function makeFacade(portal) {
	const build = (segs = []) => {
		const proxy = new Proxy(function () {}, {
			get: (_, prop) => {
				if (prop === "then") return undefined;
				if (prop === "describe") {
					// Call the special describe endpoint in the worker and parse JSON
					return async () => {
						const result = await portal.call(["describe"], []);
						try {
							// return result;
							return revive(result);
							// return JSON.parse(result);
						} catch {
							return result;
						}
					};
				}
				return build(segs.concat(String(prop)));
			},
			apply: (_, __, args) => portal.call(segs, args)
		});
		return proxy;
	};
	return build([]);
}

function buildCallableFromDescribe(node, portal, path = []) {
	// Detect a "function box" from your describe output
	const isFnBox = node && typeof node === "object" && (node.__fn != null || node.__kind === "fn" || (node.name && node.props));

	if (isFnBox) {
		const name = node.__fn ?? node.name ?? "";
		const props = node.props ?? {};
		// Prebuild children so util.inspect lists them
		const children = {};
		for (const [k, v] of Object.entries(props)) {
			children[k] = buildCallableFromDescribe(v, portal, path.concat(String(k)));
		}
		const label = `[Function${name ? `: ${name}` : ""}]`;

		return new Proxy(function () {}, {
			apply: (_t, _thisArg, args) => portal.call(path, args),

			get: (_t, prop) => {
				if (prop === "name") return name;
				if (typeof util !== "undefined" && prop === util?.inspect?.custom) {
					return function (_depth, opts, inspect = util.inspect) {
						const head = opts?.colors ? opts.stylize(label, "special") : label;
						const keys = Object.keys(children);
						if (!keys.length) return head;
						const body = keys.map((k) => `${k}: ${inspect(children[k], { ...opts, depth: (opts?.depth ?? 2) - 1 })}`).join(", ");
						return `${head} { ${body} }`;
					};
				}
				if (prop in children) return children[prop];
				// optional lazy tail: allow undiscovered paths
				return buildCallableFromDescribe({ __fn: String(prop), props: {} }, portal, path.concat(String(prop)));
			},

			ownKeys: () => Object.keys(children),
			getOwnPropertyDescriptor: (_t, key) =>
				key in children ? { enumerable: true, configurable: true, writable: true, value: children[key] } : undefined
		});
	}

	if (node && typeof node === "object") {
		if (Array.isArray(node)) {
			return node.map((v, i) => buildCallableFromDescribe(v, portal, path.concat(String(i))));
		}
		const out = {};
		for (const [k, v] of Object.entries(node)) {
			out[k] = buildCallableFromDescribe(v, portal, path.concat(String(k)));
		}
		return out;
	}
	return node; // primitives as-is
}

export function makeFacade2(portal) {
	const build = (segs = []) => {
		const describe = async () => {
			const shape = await portal.call(["describe"], []);
			return buildCallableFromDescribe(shape, portal, []); // <-- key change
		};

		return new Proxy(function () {}, {
			get: (_t, prop) => {
				// Only the ROOT is thenable so: await api -> describe tree (callable)
				if (prop === "then") {
					if (segs.length === 0) {
						return (resolve, reject) => {
							Promise.resolve().then(describe).then(resolve, reject);
						};
					}
					return undefined; // subpaths stay non-thenable
				}
				if (prop === "describe") return describe;

				return build(segs.concat(String(prop)));
			},

			apply: (_t, _thisArg, args) => portal.call(segs, args)
		});
	};

	return build([]);
}
